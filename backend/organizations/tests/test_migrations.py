"""Upgrading a P1 database: organizations move to their module without losing a row."""

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE_P2 = [("accounts", "0001_initial"), ("organizations", None)]


class MoveOrganizationsMigrationTests(TransactionTestCase):
    # Restore the migrated data (the role catalogue) that TransactionTestCase's flush removes.
    serialized_rollback = True

    def setUp(self):
        # Whatever happens, leave the schema at the latest state for the next test's flush.
        self.addCleanup(lambda: self.migrate(self.latest()))

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state([t for t in targets if t[1] is not None]).apps

    def latest(self):
        return MigrationExecutor(connection).loader.graph.leaf_nodes()

    def test_rows_keys_and_relations_survive_and_gain_public_ids(self):
        old = self.migrate(BEFORE_P2)
        User = old.get_model("accounts", "User")
        Organization = old.get_model("accounts", "Organization")
        Membership = old.get_model("accounts", "Membership")
        maya = User.objects.create(email="maya@example.com", password="x")
        raj = User.objects.create(email="raj@example.com", password="x")
        riverside = Organization.objects.create(name="Riverside Invitational", kind="organizer", status="active")
        suspended = Organization.objects.create(name="Old Club", kind="club", status="suspended")
        Membership.objects.create(user=maya, organization=riverside, role="competition_director")
        Membership.objects.create(user=raj, organization=suspended, role="coach", status="revoked")

        new = self.migrate(self.latest())
        NewUser = new.get_model("accounts", "User")
        NewOrganization = new.get_model("organizations", "Organization")
        NewMembership = new.get_model("organizations", "Membership")

        users = list(NewUser.objects.order_by("pk"))
        self.assertEqual([u.pk for u in users], [maya.pk, raj.pk])
        self.assertEqual(len({u.public_id for u in users}), 2)

        river = NewOrganization.objects.get(pk=riverside.pk)
        self.assertEqual((river.name, river.status), ("Riverside Invitational", "active"))
        self.assertEqual(river.verified_at, river.created_at)  # active before P2 counts as verified
        old_club = NewOrganization.objects.get(pk=suspended.pk)
        self.assertEqual((old_club.status, old_club.verified_at), ("suspended", None))
        self.assertNotEqual(river.public_id, old_club.public_id)

        membership = NewMembership.objects.get(user_id=maya.pk)
        self.assertEqual(
            (membership.organization_id, membership.role_id, membership.status),
            (riverside.pk, "competition_director", "active"),
        )
        self.assertIsNotNone(membership.public_id)
        self.assertEqual(NewMembership.objects.count(), 2)
        # A role the catalogue doesn't list is kept (not offered for new members, grants nothing).
        legacy = new.get_model("access", "Role").objects.get(code="coach")
        self.assertEqual((legacy.is_assignable, legacy.permissions.count()), (False, 0))
        self.assertEqual(NewMembership.objects.get(user_id=raj.pk).role_id, "coach")

        tables = connection.introspection.table_names()
        self.assertIn("organizations_organization", tables)
        self.assertNotIn("accounts_organization", tables)

        # New rows still get keys after the rename (identity sequences kept).
        created = NewOrganization.objects.create(name="Club A", kind="club")
        self.assertGreater(created.pk, suspended.pk)
        self.assertEqual(created.status, "pending")

    def test_content_types_follow_the_models(self):
        self.migrate(BEFORE_P2)
        apps = self.migrate(self.latest())
        ContentType = apps.get_model("contenttypes", "ContentType")
        self.assertFalse(ContentType.objects.filter(app_label="accounts", model="organization").exists())
        self.assertTrue(ContentType.objects.filter(app_label="organizations", model="organization").exists())

    def test_the_move_can_be_reversed(self):
        self.migrate(self.latest())
        self.migrate(BEFORE_P2)
        tables = connection.introspection.table_names()
        self.assertIn("accounts_organization", tables)
        self.assertNotIn("organizations_invitation", tables)
        self.migrate(self.latest())
