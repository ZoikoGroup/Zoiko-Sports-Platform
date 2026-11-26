"""Inspect and change the role catalogue (roles and permissions are data, P3.1).

python manage.py access roles                         every role, its kinds and permissions
python manage.py access grant <role> <permission>     audited; applies on members' next request
python manage.py access revoke <role> <permission>
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from access import selectors, services
from platform_core.errors import ApiError


class Command(BaseCommand):
    help = "Inspect the role catalogue, or grant / revoke a role's permission."

    def add_arguments(self, parser: CommandParser) -> None:
        commands = parser.add_subparsers(dest="action", required=True)
        commands.add_parser("roles", help="List every role with its organization kinds and permissions.")
        for name in ("grant", "revoke"):
            command = commands.add_parser(name, help=f"{name.capitalize()} a permission for a role.")
            command.add_argument("role")
            command.add_argument("permission")

    def handle(self, *args: Any, **options: Any) -> None:
        action = options["action"]
        if action == "roles":
            for role in selectors.catalogue():
                kinds = ", ".join(role.organization_kinds) or "any"
                offered = "" if role.is_assignable else " (legacy, not offered)"
                permissions = ", ".join(p.code for p in role.permissions.all()) or "no permissions"
                self.stdout.write(f"{role.code}{offered} — {role.name} [{kinds}]: {permissions}")
            return
        change = services.grant_permission if action == "grant" else services.revoke_permission
        try:
            changed = change(options["role"], options["permission"])
        except ApiError as exc:
            raise CommandError(exc.message) from exc
        verb = "granted" if action == "grant" else "revoked"
        self.stdout.write(f"{options['permission']} {verb} for {options['role']}." if changed else "Nothing changed.")
