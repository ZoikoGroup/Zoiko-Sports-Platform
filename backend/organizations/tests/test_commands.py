"""The operator command: create -> verify -> invite -> accept -> remove, end to end."""

import re
from io import StringIO

from django.core import mail
from django.core.management import CommandError, call_command
from django.test import TestCase

from organizations import services
from organizations.models import Invitation, Membership, Organization
from organizations.selectors import eligible_contexts

from .helpers import make_user


def run(*args: str) -> str:
    out = StringIO()
    call_command("organizations", *args, stdout=out)
    return out.getvalue()


class OrganizationCommandTests(TestCase):
    def test_full_lifecycle(self):
        line = run("create", "--name", "Riverside Invitational", "--kind", "organizer", "--jurisdiction", "us-ca")
        organization = Organization.objects.get()
        self.assertIn(str(organization.public_id), line)
        self.assertEqual((organization.status, organization.jurisdiction), ("pending", "US-CA"))

        # Pending: cannot invite yet, and members would get nothing.
        with self.assertRaisesMessage(CommandError, "verified"):
            run("invite", str(organization.public_id), "--email", "maya@example.com", "--role", "competition_director")

        run("verify", str(organization.public_id))
        organization.refresh_from_db()
        self.assertEqual(organization.status, "active")
        self.assertIsNotNone(organization.verified_at)

        with self.captureOnCommitCallbacks(execute=True):
            output = run(
                "invite", str(organization.public_id), "--email", "maya@example.com", "--role", "competition_director"
            )
        match = re.search(r"#token=([\w-]+)", str(mail.outbox[-1].body))
        assert match is not None
        token = match.group(1)
        self.assertNotIn(token, output)  # tokens are emailed, never printed

        maya = make_user("maya@example.com")
        services.accept_invitation(token=token, user=maya)
        self.assertIn("organization", [c.account_type for c in eligible_contexts(maya)])

        run("suspend", str(organization.public_id))
        self.assertNotIn("organization", [c.account_type for c in eligible_contexts(maya)])
        run("reinstate", str(organization.public_id))
        self.assertIn("organization", [c.account_type for c in eligible_contexts(maya)])

        run("remove-member", str(organization.public_id), "--email", "MAYA@example.com")
        self.assertEqual(Membership.objects.get(user=maya).status, Membership.Status.REVOKED)
        self.assertNotIn("organization", [c.account_type for c in eligible_contexts(maya)])

        listing = run("list")
        self.assertIn("Riverside Invitational", listing)

    def test_revoke_invitation_and_suspend_member(self):
        organization = services.create_organization(name="Club A", kind="club", verified=True)
        invitation, _ = services.create_invitation(organization=organization, email="c@example.com", role="member")
        self.assertIn("revoked", run("revoke-invitation", str(invitation.public_id)))
        self.assertEqual(Invitation.objects.get().status, Invitation.Status.REVOKED)

        member = make_user("m@example.com")
        services.grant_membership(user=member, organization=organization, role="member")
        run("remove-member", str(organization.public_id), "--email", "m@example.com", "--suspend")
        self.assertEqual(Membership.objects.get(user=member).status, Membership.Status.SUSPENDED)

    def test_reinstating_a_never_verified_organization_returns_it_to_pending(self):
        organization = services.create_organization(name="New League", kind="organizer")
        run("suspend", str(organization.public_id))
        run("reinstate", str(organization.public_id))
        organization.refresh_from_db()
        self.assertEqual(organization.status, "pending")

    def test_a_suspended_organization_must_be_reinstated_not_verified(self):
        organization = services.create_organization(name="Club A", kind="club", verified=True)
        run("suspend", str(organization.public_id))
        with self.assertRaisesMessage(CommandError, "reinstate"):
            run("verify", str(organization.public_id))

    def test_input_errors_are_reported_plainly(self):
        organization = services.create_organization(name="Club A", kind="club", verified=True)
        for args, message in (
            (("verify", "nope"), "is not an ID"),
            (("verify", "00000000-0000-4000-8000-000000000000"), "No organization"),
            (("create", "--name", " ", "--kind", "club"), "name"),
            (("invite", str(organization.public_id), "--email", "x@example.com", "--role", "Bad Role"), "role"),
            (
                (
                    "invite",
                    str(organization.public_id),
                    "--email",
                    "x@example.com",
                    "--role",
                    "m1",
                    "--expires-days",
                    "90",
                ),
                "between 1 and 30",
            ),
            (("remove-member", str(organization.public_id), "--email", "ghost@example.com"), "not a member"),
        ):
            with self.subTest(args=args), self.assertRaisesMessage(CommandError, message):
                run(*args)
