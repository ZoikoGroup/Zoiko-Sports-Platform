"""D-046: the database itself refuses data the application would never write.

Each rule is tested by forcing a bad value past the application (a raw ORM update
or a model created directly), the way a script, an admin edit or a bug would.
"""

from datetime import timedelta
from uuid import uuid4

from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone

from access.models import ORGANIZATION_KINDS, ParticipationProfile, Permission, Role
from accounts.models import User
from audit.models import AuditEntry
from organizations.models import Invitation, Membership, Organization
from outbox.models import Delivery, OutboxEvent


class Rejects:
    """Helpers: run a write in a savepoint and expect the named constraint to refuse it."""

    def assertRefused(self, constraint: str, write) -> None:
        with self.assertRaises(IntegrityError) as raised, transaction.atomic():  # type: ignore[attr-defined]
            write()
        self.assertIn(constraint, str(raised.exception))  # type: ignore[attr-defined]


class OrganizationRulesTests(Rejects, TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(
            name="Riverside", kind="organizer", status="active", verified_at=timezone.now()
        )
        self.user = User.objects.create_user("maya@example.com", "x")
        self.role = Role.objects.get(code="competition_director")
        self.membership = Membership.objects.create(user=self.user, organization=self.organization, role=self.role)

    def update(self, model, **values):
        return lambda: model.objects.filter(pk=self.pk_of(model)).update(**values)

    def pk_of(self, model):
        return {Organization: self.organization.pk, Membership: self.membership.pk}[model]

    def test_organization_values_and_verification(self):
        self.assertRefused("organization_kind_valid", self.update(Organization, kind="league"))
        self.assertRefused("organization_status_valid", self.update(Organization, status="activ"))
        self.assertRefused("organization_active_is_verified", self.update(Organization, verified_at=None))
        Organization.objects.filter(pk=self.organization.pk).update(status="suspended", verified_at=None)  # allowed

    def test_membership_status_and_validity_window(self):
        self.assertRefused("membership_status_valid", self.update(Membership, status="invited"))
        now = timezone.now()
        self.assertRefused(
            "membership_validity_window_ordered", self.update(Membership, valid_from=now, valid_to=now - timedelta(1))
        )
        self.assertRefused("membership_validity_window_ordered", self.update(Membership, valid_from=now, valid_to=now))
        Membership.objects.filter(pk=self.membership.pk).update(valid_from=now, valid_to=now + timedelta(1))
        Membership.objects.filter(pk=self.membership.pk).update(valid_from=None, valid_to=now)

    def test_invitation_values_email_and_final_states(self):
        invitation = Invitation.objects.create(
            organization=self.organization,
            email="casey@example.com",
            role=self.role,
            token_hash="a" * 64,
            expires_at=timezone.now() + timedelta(days=7),
        )
        rows = Invitation.objects.filter(pk=invitation.pk)
        self.assertRefused("invitation_status_valid", lambda: rows.update(status="expired"))
        self.assertRefused("invitation_email_lowercase", lambda: rows.update(email="Casey@example.com"))
        self.assertRefused("invitation_accepted_has_time", lambda: rows.update(status="accepted"))
        self.assertRefused("invitation_revoked_has_time", lambda: rows.update(status="revoked"))
        rows.update(status="revoked", revoked_at=timezone.now())  # allowed


class CatalogueAndRecordRulesTests(Rejects, TestCase):
    def test_codes_have_their_format(self):
        self.assertRefused("role_code_format", lambda: Role.objects.create(code="Venue Manager", name="x"))
        self.assertRefused(
            "role_organization_kinds_valid",
            lambda: Role.objects.create(code="league_admin", name="x", organization_kinds=["league"]),
        )
        self.assertRefused(
            "permission_code_format", lambda: Permission.objects.create(code="activity", description="x")
        )
        self.assertRefused(
            "participation_profile_code_format", lambda: ParticipationProfile.objects.create(code="Club!", name="x")
        )
        Role.objects.create(code="league_admin", name="League admin", organization_kinds=["organizer", "club"])

    def test_role_kinds_list_matches_organization_kinds(self):
        self.assertEqual(sorted(ORGANIZATION_KINDS), sorted(Organization.Kind.values))

    def test_audit_outcome_and_action(self):
        now = timezone.now()
        self.assertRefused(
            "audit_outcome_valid", lambda: AuditEntry.objects.create(occurred_at=now, action="a.b", outcome="ok")
        )
        self.assertRefused("audit_action_format", lambda: AuditEntry.objects.create(occurred_at=now, action="Sign In"))

    def test_outbox_event_and_delivery(self):
        now = timezone.now()

        def event(**values):
            fields = {"type": "thing.happened", "version": 1, "aggregate_type": "t", "aggregate_id": "1"}
            return OutboxEvent.objects.create(payload={}, occurred_at=now, **{**fields, **values})

        self.assertRefused("outbox_event_type_format", lambda: event(type="ThingHappened"))
        self.assertRefused("outbox_event_version_positive", lambda: event(version=0))
        delivery = Delivery.objects.create(event=event(), consumer="tests.x", available_at=now)
        rows = Delivery.objects.filter(pk=delivery.pk)
        self.assertRefused("outbox_delivery_status_valid", lambda: rows.update(status="sent"))
        self.assertRefused("outbox_delivery_done_has_time", lambda: rows.update(status="done"))
        rows.update(status="done", delivered_at=now)  # allowed


class EmailRulesTests(Rejects, TestCase):
    def test_emails_are_stored_in_lower_case_and_unique_whatever_the_capitals(self):
        User.objects.create_user("Maya@Club.com", "x")
        self.assertTrue(User.objects.filter(email="maya@club.com").exists())  # the manager lowercases
        self.assertRefused("user_email_lowercase", lambda: User.objects.create(email="Raj@club.com", public_id=uuid4()))
        with connection.cursor() as cursor:
            cursor.execute("SELECT indexdef FROM pg_indexes WHERE indexname = 'user_email_unique_any_case'")
            (definition,) = cursor.fetchone()
        self.assertIn("UNIQUE INDEX", definition)
        self.assertIn("upper((email)::text)", definition)

    def test_forms_save_the_lower_case_form(self):
        user = User(email="  Kai@Club.COM", full_name="Kai")
        user.clean()
        self.assertEqual(user.email, "kai@club.com")


class SchemaTidinessTests(TestCase):
    def indexes(self, table: str) -> dict[str, str]:
        with connection.cursor() as cursor:
            cursor.execute("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = %s", [table])
            return dict(cursor.fetchall())

    def test_no_object_keeps_its_pre_p2_name(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT conname FROM pg_constraint WHERE conname LIKE 'accounts\\_membership%%' "
                "OR conname LIKE 'accounts\\_organization%%' "
                "UNION SELECT indexname FROM pg_indexes WHERE indexname LIKE 'accounts\\_membership%%' "
                "OR indexname LIKE 'accounts\\_organization%%'"
            )
            self.assertEqual(cursor.fetchall(), [])
        self.assertIn("organizations_membership_organization_idx", self.indexes("organizations_membership"))

    def test_indexes_duplicating_a_unique_index_are_gone(self):
        single_column = {
            "organizations_membership": ["(user_id)", "(role)"],
            "organizations_invitation": ["(role)"],
            "access_rolepermission": ["(role_id)"],
            "outbox_delivery": ["(event_id)"],
        }
        for table, columns in single_column.items():
            definitions = self.indexes(table).values()
            for column in columns:
                with self.subTest(table=table, column=column):
                    self.assertFalse([d for d in definitions if d.endswith(column) or f"{column[:-1]} varchar" in d])
