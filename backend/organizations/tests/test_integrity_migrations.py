"""D-046: upgrading an existing database brings old rows into line before the new rules apply."""

from datetime import timedelta
from uuid import uuid4

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE = [("accounts", "0003_move_organizations"), ("organizations", "0003_roles_from_catalogue")]


class IntegrityMigrationTests(TransactionTestCase):
    # Restore the migrated data (the role catalogue) that TransactionTestCase's flush removes.
    serialized_rollback = True

    def setUp(self):
        self.addCleanup(lambda: self.migrate(self.latest()))

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def latest(self):
        return MigrationExecutor(connection).loader.graph.leaf_nodes()

    def old_rows(self):
        old = self.migrate(BEFORE)
        User = old.get_model("accounts", "User")
        Organization = old.get_model("organizations", "Organization")
        Membership = old.get_model("organizations", "Membership")
        Invitation = old.get_model("organizations", "Invitation")
        return old, User, Organization, Membership, Invitation

    def test_old_rows_are_brought_into_line(self):
        _, User, Organization, Membership, Invitation = self.old_rows()
        now = timezone.now()
        maya = User.objects.create(email="Maya@Club.com", password="x", public_id=uuid4())
        legacy = Organization.objects.create(name="Old Club", kind="club", status="active", public_id=uuid4())
        Membership.objects.create(
            user=maya, organization=legacy, role_id="club_coordinator", status="invited", public_id=uuid4()
        )
        common = {"organization": legacy, "role_id": "club_coordinator", "expires_at": now + timedelta(days=7)}
        Invitation.objects.create(email="Raj@Club.com", token_hash="a" * 64, public_id=uuid4(), **common)
        Invitation.objects.create(
            email="kai@club.com", token_hash="b" * 64, status="accepted", public_id=uuid4(), **common
        )
        Invitation.objects.create(
            email="lee@club.com", token_hash="c" * 64, status="revoked", public_id=uuid4(), **common
        )

        new = self.migrate(self.latest())
        self.assertEqual(new.get_model("accounts", "User").objects.get(pk=maya.pk).email, "maya@club.com")
        organization = new.get_model("organizations", "Organization").objects.get(pk=legacy.pk)
        self.assertEqual(organization.verified_at, organization.created_at)
        self.assertEqual(new.get_model("organizations", "Membership").objects.get(user_id=maya.pk).status, "revoked")
        invitations = {i.token_hash[0]: i for i in new.get_model("organizations", "Invitation").objects.all()}
        self.assertEqual(invitations["a"].email, "raj@club.com")
        self.assertEqual(invitations["b"].accepted_at, invitations["b"].updated_at)
        self.assertEqual(invitations["c"].revoked_at, invitations["c"].updated_at)

    def test_emails_differing_only_in_capitals_stop_the_upgrade(self):
        _, User, *_ = self.old_rows()
        User.objects.create(email="maya@club.com", password="x", public_id=uuid4())
        User.objects.create(email="MAYA@club.com", password="x", public_id=uuid4())
        with self.assertRaisesMessage(RuntimeError, "same email apart from capitals"):
            self.migrate([("accounts", "0004_email_rules")])
        User.objects.filter(email="MAYA@club.com").delete()  # the operator's fix; then the upgrade runs

    def test_a_reversed_validity_window_stops_the_upgrade(self):
        _, User, Organization, Membership, _ = self.old_rows()
        now = timezone.now()
        user = User.objects.create(email="x@club.com", password="x", public_id=uuid4())
        club = Organization.objects.create(name="C", kind="club", status="active", verified_at=now, public_id=uuid4())
        Membership.objects.create(
            user=user,
            organization=club,
            role_id="club_coordinator",
            valid_from=now,
            valid_to=now - timedelta(1),
            public_id=uuid4(),
        )
        with self.assertRaisesMessage(RuntimeError, "end before they start"):
            self.migrate([("organizations", "0004_integrity_rules")])
        Membership.objects.filter(user=user).update(valid_to=None)  # the operator's fix; then the upgrade runs

    def test_the_corrections_can_be_reversed(self):
        self.migrate(BEFORE)
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_indexes WHERE indexname = 'accounts_membership_organization_id_936776de'")
            self.assertIsNotNone(cursor.fetchone())
            cursor.execute("SELECT 1 FROM pg_constraint WHERE conname = 'organization_status_valid'")
            self.assertIsNone(cursor.fetchone())
