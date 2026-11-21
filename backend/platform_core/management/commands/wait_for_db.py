"""Block until the database accepts connections (or give up after a timeout).

Used before `migrate` by the container entrypoint and the test harnesses, so a
starting PostgreSQL is waited for instead of failing the deployment.
"""

import time
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import DatabaseError, connections


class Command(BaseCommand):
    help = "Wait until the default database accepts connections."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--timeout", type=float, default=60.0, help="Seconds to keep trying (default 60).")
        parser.add_argument("--interval", type=float, default=1.0, help="Seconds between attempts (default 1).")

    def handle(self, *args: Any, **options: Any) -> None:
        timeout: float = options["timeout"]
        interval: float = options["interval"]
        if timeout <= 0 or interval <= 0:
            raise CommandError("--timeout and --interval must be positive.")

        connection = connections["default"]
        deadline = time.monotonic() + timeout
        attempts = 0
        while True:
            attempts += 1
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                break
            except DatabaseError as exc:
                connection.close()
                if time.monotonic() + interval > deadline:
                    raise CommandError(
                        f"Database unavailable after {attempts} attempt(s): {type(exc).__name__}"
                    ) from exc
                time.sleep(interval)
        self.stdout.write(f"Database available (attempt {attempts}).")
