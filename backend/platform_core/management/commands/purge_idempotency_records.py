"""Delete expired idempotency records (run on a schedule; see platform_core.idempotency)."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from platform_core.idempotency import purge_expired


class Command(BaseCommand):
    help = "Delete idempotency records whose retention period has ended."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--batch-size", type=int, default=1000, help="Rows deleted per statement (default 1000).")

    def handle(self, *args: Any, **options: Any) -> None:
        batch_size: int = options["batch_size"]
        if batch_size <= 0:
            raise CommandError("--batch-size must be positive.")
        removed = purge_expired(batch_size)
        self.stdout.write(f"Removed {removed} expired idempotency record(s).")
