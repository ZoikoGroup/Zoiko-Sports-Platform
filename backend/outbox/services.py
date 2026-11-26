"""Publishing events and subscribing consumers (the outbox's public write interface).

Publisher, inside the transaction that changes the data:

    publish(INVITATION_ACCEPTED, {...}, aggregate=("invitation", invitation.public_id),
            organization_id=organization.public_id)

Consumer, at start-up (its AppConfig.ready):

    subscribe("activity.feed", [INVITATION_ACCEPTED, ...], handle)

The worker calls `handle(event)` once per event and consumer. A consumer must be
safe to run twice (duplicates are possible after a replay) and must not assume
order between different aggregates. An exception means "retry later".
"""

import json
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from audit.services import record
from platform_core.events import EventContractError, EventType
from platform_core.request_context import get_request_id

from .models import Delivery, OutboxEvent

CONSUMER_PATTERN_HELP = "Consumer names look like '<module>.<purpose>', e.g. activity.feed."


@dataclass(frozen=True)
class DeliveredEvent:
    """What a consumer receives."""

    id: UUID
    type: str
    version: int
    payload: dict[str, Any]
    aggregate_type: str
    aggregate_id: str
    aggregate_version: int | None
    organization_id: UUID | None
    occurred_at: datetime
    request_id: str

    @property
    def key(self) -> str:
        return f"{self.type}.v{self.version}"


Handler = Callable[[DeliveredEvent], None]


@dataclass(frozen=True)
class Consumer:
    name: str
    event_keys: frozenset[str]
    handler: Handler


_consumers: dict[str, Consumer] = {}


def subscribe(name: str, event_types: Iterable[EventType], handler: Handler) -> None:
    """Register a consumer for these event types (idempotent for the same handler)."""
    if "." not in name:
        raise ValueError(CONSUMER_PATTERN_HELP)
    keys = frozenset(t.key for t in event_types)
    existing = _consumers.get(name)
    if existing is not None and existing.handler is not handler:
        raise ValueError(f"Consumer {name!r} is already registered with another handler.")
    _consumers[name] = Consumer(name, keys | (existing.event_keys if existing else frozenset()), handler)


def unsubscribe(name: str) -> None:
    _consumers.pop(name, None)


def consumers() -> dict[str, Consumer]:
    return dict(_consumers)


def consumers_of(event_key: str) -> list[str]:
    return sorted(name for name, consumer in _consumers.items() if event_key in consumer.event_keys)


def _json_safe(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result: dict[str, Any] = json.loads(json.dumps(payload, cls=DjangoJSONEncoder))
    except (TypeError, ValueError) as exc:
        raise EventContractError(f"Event payload is not JSON-serialisable: {exc}") from exc
    return result


def publish(
    event_type: EventType,
    payload: dict[str, Any],
    *,
    aggregate: tuple[str, Any],
    aggregate_version: int | None = None,
    organization_id: UUID | None = None,
) -> OutboxEvent:
    """Store an event and one delivery per subscribed consumer, in the caller's transaction."""
    event_type.validate(payload)
    with transaction.atomic():
        now = timezone.now()
        event = OutboxEvent.objects.create(
            type=event_type.name,
            version=event_type.version,
            aggregate_type=aggregate[0],
            aggregate_id=str(aggregate[1]),
            aggregate_version=aggregate_version,
            organization_id=organization_id,
            payload=_json_safe(payload),
            occurred_at=now,
            request_id=get_request_id() or "",
        )
        Delivery.objects.bulk_create(
            Delivery(event=event, consumer=name, available_at=now) for name in consumers_of(event_type.key)
        )
    return event


def to_delivered(event: OutboxEvent) -> DeliveredEvent:
    return DeliveredEvent(
        id=event.event_id,
        type=event.type,
        version=event.version,
        payload=event.payload,
        aggregate_type=event.aggregate_type,
        aggregate_id=event.aggregate_id,
        aggregate_version=event.aggregate_version,
        organization_id=event.organization_id,
        occurred_at=event.occurred_at,
        request_id=event.request_id,
    )


def replay(*, consumer: str | None = None, event_id: UUID | None = None, include_done: bool = False) -> int:
    """Queue deliveries again: dead ones (default), or done ones too. Returns how many."""
    statuses = [Delivery.Status.DEAD] + ([Delivery.Status.DONE] if include_done else [])
    deliveries = Delivery.objects.filter(status__in=statuses)
    if consumer:
        deliveries = deliveries.filter(consumer=consumer)
    if event_id:
        deliveries = deliveries.filter(event__event_id=event_id)
    with transaction.atomic():
        count = deliveries.update(
            status=Delivery.Status.PENDING, attempts=0, available_at=timezone.now(), last_error="", delivered_at=None
        )
        if count:
            record(
                "outbox.replayed",
                context=None,
                details={"deliveries": count, "consumer": consumer or "", "include_done": include_done},
            )
    return count


def backfill(consumer: str, *, since: datetime | None = None) -> int:
    """Create deliveries of past events for a consumer added later (its own event types only)."""
    registered = _consumers.get(consumer)
    if registered is None:
        raise ValueError(f"No consumer named {consumer!r} is registered.")
    wanted = Q()
    for key in registered.event_keys:
        name, version = key.rsplit(".v", 1)
        wanted |= Q(type=name, version=int(version))
    events = OutboxEvent.objects.filter(wanted).exclude(deliveries__consumer=consumer)
    if since is not None:
        events = events.filter(occurred_at__gte=since)
    now = timezone.now()
    with transaction.atomic():
        created = Delivery.objects.bulk_create(
            Delivery(event=event, consumer=consumer, available_at=now) for event in events.only("id").iterator()
        )
    return len(created)


def purge_delivered() -> int:
    """Scheduled housekeeping: purge fully delivered events older than OUTBOX_RETENTION_DAYS."""
    return purge(older_than=timezone.now() - timedelta(days=settings.OUTBOX_RETENTION_DAYS))


def purge(*, older_than: datetime) -> int:
    """Delete events older than `older_than` whose deliveries are all done. Returns events deleted."""
    candidates = OutboxEvent.objects.filter(occurred_at__lt=older_than).exclude(
        deliveries__status__in=[Delivery.Status.PENDING, Delivery.Status.DEAD]
    )
    _, per_model = candidates.delete()
    return per_model.get(OutboxEvent._meta.label, 0)
