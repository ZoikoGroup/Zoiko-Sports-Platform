"""Run the scheduled housekeeping now (platform_core.maintenance).

    python manage.py maintenance          run every registered task
    python manage.py maintenance --list   show the tasks without running them

The outbox worker also runs it every MAINTENANCE_INTERVAL_HOURS.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from platform_core import maintenance


class Command(BaseCommand):
    help = "Remove expired sessions, idempotency records and old delivered events."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--list", action="store_true", help="List the tasks without running them.")

    def handle(self, *args: Any, **options: Any) -> None:
        if options["list"]:
            for name in maintenance.registered():
                self.stdout.write(name)
            return
        results = maintenance.run_all()
        for name, removed in results.items():
            self.stdout.write(f"{name}: {'FAILED (see the log)' if removed is None else f'{removed} removed'}")
        if any(removed is None for removed in results.values()):
            raise CommandError("A housekeeping task failed.")
