"""Zoiko operator commands for organizations, until the Internal Administration product exists.

    manage.py organizations list
    manage.py organizations create --name "Riverside Invitational" --kind organizer [--jurisdiction US-CA] [--verified]
    manage.py organizations verify <organization-id>
    manage.py organizations suspend <organization-id>
    manage.py organizations reinstate <organization-id>
    manage.py organizations invite <organization-id> --email person@example.com --role venue_manager [--expires-days 7]
    manage.py organizations revoke-invitation <invitation-id>
    manage.py organizations remove-member <organization-id> --email person@example.com [--suspend]

IDs are the public UUIDs printed by `list` and `create`. Invitation tokens are
emailed, never printed; every change is logged with the operator-visible IDs.
"""

from argparse import ArgumentParser
from datetime import timedelta
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from platform_core.errors import ApiError

from ... import services
from ...models import Invitation, Membership, Organization


def _uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise CommandError(f"{value!r} is not an ID (expected a UUID; see `organizations list`).") from None


class Command(BaseCommand):
    help = "Create, verify, suspend and reinstate organizations; invite members and remove access."

    def add_arguments(self, parser: ArgumentParser) -> None:
        commands = parser.add_subparsers(dest="action", required=True)

        commands.add_parser("list", help="List organizations with their IDs and status.")

        create = commands.add_parser("create", help="Create an organization (pending verification by default).")
        create.add_argument("--name", required=True)
        create.add_argument("--kind", required=True, choices=Organization.Kind.values)
        create.add_argument("--jurisdiction", default="")
        create.add_argument("--verified", action="store_true", help="Create it already verified.")

        for name, text in (
            ("verify", "Verify a pending organization so its members get its workspace."),
            ("suspend", "Suspend an organization: members lose its workspace on their next request."),
            ("reinstate", "Lift a suspension."),
        ):
            command = commands.add_parser(name, help=text)
            command.add_argument("organization")

        invite = commands.add_parser("invite", help="Email a single-use invitation to join an organization.")
        invite.add_argument("organization")
        invite.add_argument("--email", required=True)
        invite.add_argument("--role", required=True)
        invite.add_argument("--expires-days", type=int, default=None, help="Default: INVITATION_TTL_DAYS.")

        revoke = commands.add_parser("revoke-invitation", help="Revoke a pending invitation.")
        revoke.add_argument("invitation")

        remove = commands.add_parser("remove-member", help="Revoke (or suspend) a member's access.")
        remove.add_argument("organization")
        remove.add_argument("--email", required=True)
        remove.add_argument("--suspend", action="store_true", help="Suspend instead of revoking.")

    def handle(self, *args: Any, **options: Any) -> None:
        action = options["action"].replace("-", "_")
        try:
            getattr(self, f"do_{action}")(options)
        except ApiError as exc:
            details = "; ".join(f"{field}: {' '.join(msgs)}" for field, msgs in (exc.fields or {}).items())
            raise CommandError(f"{exc.message} {details}".strip()) from None

    def _organization(self, value: str) -> Organization:
        organization = Organization.objects.filter(public_id=_uuid(value)).first()
        if organization is None:
            raise CommandError(f"No organization with ID {value}.")
        return organization

    def _report(self, organization: Organization) -> None:
        self.stdout.write(
            f"{organization.public_id}  {organization.kind:<9}  {organization.status:<9}  {organization.name}"
        )

    def do_list(self, options: dict[str, Any]) -> None:
        for organization in Organization.objects.order_by("name", "pk"):
            self._report(organization)

    def do_create(self, options: dict[str, Any]) -> None:
        organization = services.create_organization(
            name=options["name"],
            kind=options["kind"],
            jurisdiction=options["jurisdiction"],
            verified=options["verified"],
        )
        self._report(organization)

    def do_verify(self, options: dict[str, Any]) -> None:
        self._report(services.verify_organization(self._organization(options["organization"])))

    def do_suspend(self, options: dict[str, Any]) -> None:
        self._report(services.suspend_organization(self._organization(options["organization"])))

    def do_reinstate(self, options: dict[str, Any]) -> None:
        self._report(services.reinstate_organization(self._organization(options["organization"])))

    def do_invite(self, options: dict[str, Any]) -> None:
        days = options["expires_days"]
        if days is not None and not 1 <= days <= 30:
            raise CommandError("--expires-days must be between 1 and 30.")
        invitation, _token = services.create_invitation(
            organization=self._organization(options["organization"]),
            email=options["email"],
            role=options["role"],
            ttl=timedelta(days=days) if days else None,
        )
        self.stdout.write(
            f"Invitation {invitation.public_id} emailed; it expires {invitation.expires_at:%Y-%m-%d %H:%M} UTC."
        )

    def do_revoke_invitation(self, options: dict[str, Any]) -> None:
        invitation = Invitation.objects.filter(public_id=_uuid(options["invitation"])).first()
        if invitation is None:
            raise CommandError(f"No invitation with ID {options['invitation']}.")
        invitation = services.revoke_invitation(invitation)
        self.stdout.write(f"Invitation {invitation.public_id} is {invitation.status}.")

    def do_remove_member(self, options: dict[str, Any]) -> None:
        organization = self._organization(options["organization"])
        user = get_user_model().objects.filter(email__iexact=options["email"].strip()).first()
        status_value = Membership.Status.SUSPENDED if options["suspend"] else Membership.Status.REVOKED
        membership = (
            services.set_membership_status(user=user, organization=organization, status_value=status_value)
            if user is not None
            else None
        )
        if membership is None:
            raise CommandError("That account is not a member of this organization.")
        self.stdout.write(f"Membership {membership.public_id} is {membership.status}.")
