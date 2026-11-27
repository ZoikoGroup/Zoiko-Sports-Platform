"""Operate the event backbone (P4.5).

python manage.py outbox worker                 run the worker until SIGTERM / Ctrl+C
python manage.py outbox worker --once          deliver what is due now, then exit
python manage.py outbox status                 queue sizes, dead letters, delivery lag
python manage.py outbox replay                 requeue every dead delivery
python manage.py outbox replay --consumer activity.feed --event <uuid> [--include-done]
python manage.py outbox backfill activity.feed [--since 2026-11-01]
python manage.py outbox purge --older-than-days 30
"""

from datetime import datetime, time, timedelta
from typing import Any
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from outbox import selectors, services, worker


class Command(BaseCommand):
    help = "Operate the outbox: run the worker, inspect the queue, replay dead letters, purge old events."

    def add_arguments(self, parser: CommandParser) -> None:
        commands = parser.add_subparsers(dest="action", required=True)
        run = commands.add_parser("worker", help="Deliver events to consumers until stopped.")
        run.add_argument("--once", action="store_true", help="Deliver what is due now, then exit.")
        commands.add_parser("status", help="Queue sizes, dead letters and delivery lag.")
        replay = commands.add_parser("replay", help="Requeue dead deliveries.")
        replay.add_argument("--consumer", help="Only this consumer.")
        replay.add_argument("--event", type=UUID, help="Only this event ID.")
        replay.add_argument("--include-done", action="store_true", help="Requeue completed deliveries too.")
        backfill = commands.add_parser("backfill", help="Deliver past events to a consumer added later.")
        backfill.add_argument("consumer")
        backfill.add_argument("--since", type=datetime.fromisoformat, help="Only events from this date (ISO).")
        purge = commands.add_parser("purge", help="Delete old events whose deliveries are all done.")
        purge.add_argument("--older-than-days", type=int, required=True)

    def handle(self, *args: Any, **options: Any) -> None:
        getattr(self, f"_{options['action']}")(options)

    def _worker(self, options: dict[str, Any]) -> None:
        if options["once"]:
            self.stdout.write(f"Delivered {worker.deliver_due()} event deliveries.")
            return
        worker.run_forever()  # pragma: no cover - long-running; covered by the Docker stack check

    def _status(self, options: dict[str, Any]) -> None:
        s = selectors.stats()

        def ms(value: int | None) -> str:
            return "—" if value is None else f"{value} ms"

        oldest = "—" if s.oldest_pending_seconds is None else f"{s.oldest_pending_seconds:.1f} s"
        self.stdout.write(f"pending {s.pending} (due now {s.due}) · dead {s.dead} · done {s.done}")
        self.stdout.write(f"oldest pending event {oldest}")
        self.stdout.write(f"delivery lag, last hour: p50 {ms(s.lag_p50_ms)} · p95 {ms(s.lag_p95_ms)}")
        for consumer, count in sorted(s.dead_by_consumer.items()):
            self.stdout.write(f"dead for {consumer}: {count}")
        registered = services.consumers()
        self.stdout.write("consumers: " + (", ".join(sorted(registered)) or "none"))

    def _replay(self, options: dict[str, Any]) -> None:
        count = services.replay(
            consumer=options["consumer"], event_id=options["event"], include_done=options["include_done"]
        )
        self.stdout.write(f"Requeued {count} deliveries.")

    def _backfill(self, options: dict[str, Any]) -> None:
        since = options["since"]
        if since is not None and timezone.is_naive(since):
            since = timezone.make_aware(since)
        try:
            count = services.backfill(options["consumer"], since=since)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(f"Queued {count} past events for {options['consumer']}.")

    def _purge(self, options: dict[str, Any]) -> None:
        days = options["older_than_days"]
        if days < 1:
            raise CommandError("--older-than-days must be at least 1.")
        cutoff = timezone.make_aware(datetime.combine(timezone.localdate() - timedelta(days=days), time.min))
        self.stdout.write(f"Deleted {services.purge(older_than=cutoff)} events delivered before {cutoff:%Y-%m-%d}.")
