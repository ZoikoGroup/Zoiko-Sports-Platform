"""Read the audit trail (operators only; there is deliberately no public API yet).

python manage.py audit                       the 20 newest entries
python manage.py audit --limit 100 --action invitation.accepted
python manage.py audit --organization <public UUID> --actor <public UUID>
"""

from typing import Any
from uuid import UUID

from django.core.management.base import BaseCommand, CommandParser

from audit.selectors import entries


class Command(BaseCommand):
    help = "Print the newest audit entries (append-only trail)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--action", help="Only this action, e.g. auth.sign_in_failed.")
        parser.add_argument("--actor", type=UUID, help="Only this user (public UUID).")
        parser.add_argument("--organization", type=UUID, help="Only this acting organization (public UUID).")

    def handle(self, *args: Any, **options: Any) -> None:
        limit = max(1, min(options["limit"], 10_000))
        rows = entries(
            action=options["action"], actor_id=options["actor"], organization_id=options["organization"], limit=limit
        )
        for entry in rows:
            target = f" {entry.target_type}={entry.target_id}" if entry.target_type else ""
            actor = f" actor={entry.actor_id}" if entry.actor_id else ""
            org = f" organization={entry.organization_id} role={entry.role}" if entry.organization_id else ""
            details = f" {entry.details}" if entry.details else ""
            self.stdout.write(
                f"{entry.occurred_at:%Y-%m-%dT%H:%M:%SZ} {entry.action} {entry.outcome}{actor}{org}{target}"
                f" request={entry.request_id or '-'}{details}"
            )
