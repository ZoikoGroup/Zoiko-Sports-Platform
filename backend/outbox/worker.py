"""The background worker: delivers outbox events to their consumers (P4.2).

Run it as its own process (`python manage.py outbox worker`; the `worker`
service in docker-compose.yml). Several workers may run side by side.

One delivery at a time, in one transaction:
1. claim the oldest due pending delivery with SELECT … FOR UPDATE SKIP LOCKED,
   so two workers never take the same one;
2. run the consumer inside a savepoint, with the event's correlation ID;
3. success: mark it done. Failure: roll the consumer's writes back, count the
   attempt and schedule a retry with exponential backoff; after
   OUTBOX_MAX_ATTEMPTS it becomes "dead" (visible in `outbox status`,
   requeued with `outbox replay`).
4. commit. The consumer's effect and "done" commit together: if the worker dies
   mid-way the transaction rolls back and the row lock is released, so the
   delivery is simply picked up again: each effect happens exactly once.
"""

import logging
import signal
import threading
import time
from datetime import timedelta
from pathlib import Path
from types import FrameType

from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.utils import timezone

from platform_core import maintenance
from platform_core.request_context import request_context

from .models import Delivery
from .services import Consumer, consumers, to_delivered

logger = logging.getLogger(__name__)
MAX_ERROR_LENGTH = 2000


def retry_delay(attempts: int) -> timedelta:
    """Exponential backoff: base, 2 * base, 4 * base ... capped at OUTBOX_RETRY_MAX_SECONDS."""
    seconds = settings.OUTBOX_RETRY_BASE_SECONDS * (2 ** max(attempts - 1, 0))
    return timedelta(seconds=min(seconds, settings.OUTBOX_RETRY_MAX_SECONDS))


def deliver_next() -> Delivery | None:
    """Process one due delivery; None when nothing is due."""
    registered = consumers()
    with transaction.atomic():
        delivery = (
            Delivery.objects.select_for_update(skip_locked=True, of=("self",))
            .select_related("event")
            .filter(status=Delivery.Status.PENDING, available_at__lte=timezone.now())
            .order_by("available_at", "id")
            .first()
        )
        if delivery is None:
            return None
        # The consumer's work and the worker's log lines carry the correlation ID of the
        # request that made the change, so one ID traces it from the API to every consumer.
        with request_context(delivery.event.request_id or None):
            _attempt(delivery, registered.get(delivery.consumer))
        delivery.save(update_fields=["status", "attempts", "available_at", "last_error", "delivered_at"])
    return delivery


def _attempt(delivery: Delivery, consumer: Consumer | None) -> None:
    """Run the consumer in a savepoint and record the outcome on `delivery` (saved by the caller)."""
    event = delivery.event
    delivery.attempts += 1
    try:
        if consumer is None:
            raise LookupError(f"No consumer named {delivery.consumer!r} is registered in this process.")
        with transaction.atomic():
            consumer.handler(to_delivered(event))
    except Exception as exc:
        delivery.last_error = f"{type(exc).__name__}: {exc}"[:MAX_ERROR_LENGTH]
        if delivery.attempts >= settings.OUTBOX_MAX_ATTEMPTS:
            delivery.status = Delivery.Status.DEAD
            logger.error(
                "Event delivery dead event=%s type=%s consumer=%s attempts=%d error=%s",
                event.event_id,
                event.type,
                delivery.consumer,
                delivery.attempts,
                type(exc).__name__,
            )
        else:
            delivery.available_at = timezone.now() + retry_delay(delivery.attempts)
            logger.warning(
                "Event delivery failed event=%s type=%s consumer=%s attempt=%d retry_at=%s error=%s",
                event.event_id,
                event.type,
                delivery.consumer,
                delivery.attempts,
                delivery.available_at.isoformat(),
                type(exc).__name__,
            )
    else:
        delivery.status = Delivery.Status.DONE
        delivery.delivered_at = timezone.now()
        delivery.last_error = ""
        lag_ms = int((delivery.delivered_at - event.occurred_at).total_seconds() * 1000)
        logger.info(
            "Event delivered event=%s type=%s consumer=%s lag_ms=%d",
            event.event_id,
            event.type,
            delivery.consumer,
            lag_ms,
        )


def deliver_due(limit: int | None = None) -> int:
    """Process due deliveries until none is left (or `limit`); returns how many were processed."""
    processed = 0
    while limit is None or processed < limit:
        if deliver_next() is None:
            break
        processed += 1
    return processed


class Worker:
    """The polling loop: deliver what is due, then sleep briefly; stops on SIGTERM/SIGINT."""

    def __init__(
        self,
        *,
        poll_interval: float,
        batch_size: int,
        heartbeat: Path | None = None,
        maintenance_interval: float = 0,
    ) -> None:
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.heartbeat = heartbeat
        # Seconds between housekeeping runs (platform_core.maintenance); 0 = never.
        self.maintenance_interval = maintenance_interval
        self.next_maintenance = time.monotonic()
        self.stopping = threading.Event()

    def maintain_if_due(self) -> None:
        if self.maintenance_interval <= 0 or time.monotonic() < self.next_maintenance:
            return
        self.next_maintenance = time.monotonic() + self.maintenance_interval
        maintenance.run_all()

    def stop(self, signum: int | None = None, frame: FrameType | None = None) -> None:
        if not self.stopping.is_set():
            logger.info("Worker stopping (signal %s); finishing the current delivery", signum)
        self.stopping.set()

    def install_signal_handlers(self) -> None:
        signal.signal(signal.SIGTERM, self.stop)
        signal.signal(signal.SIGINT, self.stop)

    @staticmethod
    def refresh_connection() -> None:
        # Drop broken or expired database connections between loops (never inside a transaction).
        if not connection.in_atomic_block:
            close_old_connections()

    def beat(self) -> None:
        if self.heartbeat is not None:
            self.heartbeat.parent.mkdir(parents=True, exist_ok=True)
            self.heartbeat.touch()

    def run(self, *, max_loops: int | None = None) -> None:
        logger.info(
            "Worker started consumers=%s poll_interval=%.2fs", ",".join(sorted(consumers())), self.poll_interval
        )
        loops = 0
        while not self.stopping.is_set() and (max_loops is None or loops < max_loops):
            loops += 1
            self.refresh_connection()
            self.beat()
            try:
                self.maintain_if_due()
                processed = deliver_due(self.batch_size)
            except Exception:
                # A database outage must not kill the worker: log, wait, try again.
                logger.exception("Worker loop failed; retrying after the poll interval")
                processed = 0
            if processed < self.batch_size:
                self.stopping.wait(self.poll_interval)
        self.refresh_connection()
        logger.info("Worker stopped")


def run_forever() -> None:  # pragma: no cover - exercised by the Docker stack check
    heartbeat = settings.OUTBOX_HEARTBEAT_FILE
    worker = Worker(
        poll_interval=settings.OUTBOX_POLL_INTERVAL_SECONDS,
        batch_size=settings.OUTBOX_BATCH_SIZE,
        heartbeat=Path(heartbeat) if heartbeat else None,
        maintenance_interval=settings.MAINTENANCE_INTERVAL_HOURS * 3600,
    )
    worker.install_signal_handlers()
    worker.run()
