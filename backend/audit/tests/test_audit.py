"""P3.7: the append-only audit trail, and that every required action is recorded."""

from io import StringIO
from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.db import DatabaseError, connection, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from access.tests.golden import PASSWORD, Golden, build_golden
from accounts.models import User
from accounts.tokens import email_verification_token, encode_uid, password_reset_token
from audit.models import AuditEntry
from audit.services import record
from organizations import services as org_services
from platform_core.errors import ApiError
from platform_core.request_context import request_context
from platform_core.workspace import WorkspaceContext, set_current_context


def actions(**filters) -> list[str]:
    return list(AuditEntry.objects.filter(**filters).order_by("id").values_list("action", flat=True))


class RecordTests(TestCase):
    def test_fields_and_defaults(self):
        user = User.objects.create_user("maya@example.com", PASSWORD)
        context = WorkspaceContext(
            id="x", account_type="organization", organization_id=1, organization_public_id=user.public_id, role="r"
        )
        set_current_context(context)
        self.addCleanup(set_current_context, None)
        with request_context("req-42"):
            entry = record("thing.happened", actor=user, target=("thing", 7), before_version=1, after_version=2)
        self.assertEqual(
            (entry.actor_id, entry.organization_id, entry.role, entry.target_type, entry.target_id, entry.request_id),
            (user.public_id, user.public_id, "r", "thing", "7", "req-42"),
        )
        self.assertEqual((entry.before_version, entry.after_version, entry.outcome), (1, 2, "success"))
        system = record("thing.happened", context=None)
        self.assertEqual((system.actor_id, system.organization_id, system.role), (None, None, ""))

    def test_rejects_malformed_actions_and_outcomes(self):
        with self.assertRaises(ValueError):
            record("NotDotted")
        with self.assertRaises(ValueError):
            record("thing.happened", outcome="maybe")

    def test_rows_cannot_be_changed_or_deleted_even_with_raw_sql(self):
        entry = record("thing.happened", context=None)
        attempts = [
            lambda: AuditEntry.objects.filter(pk=entry.pk).update(action="thing.rewritten"),
            lambda: AuditEntry.objects.filter(pk=entry.pk).delete(),
            lambda: entry.save(),
        ]

        def raw_update():
            with connection.cursor() as cursor:
                cursor.execute("UPDATE audit_auditentry SET outcome = 'denied' WHERE id = %s", [entry.pk])

        def raw_delete():
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM audit_auditentry WHERE id = %s", [entry.pk])

        for attempt in [*attempts, raw_update, raw_delete]:
            with self.subTest(attempt=attempt), self.assertRaises(DatabaseError) as raised, transaction.atomic():
                attempt()
            self.assertIn("append-only", str(raised.exception))
        entry.refresh_from_db()
        self.assertEqual((entry.action, entry.outcome), ("thing.happened", "success"))

    def test_operator_command_prints_newest_first(self):
        record("first.thing", context=None)
        record("second.thing", context=None, details={"n": 1})
        out = StringIO()
        call_command("audit", "--limit", "5", stdout=out)
        lines = out.getvalue().splitlines()
        self.assertIn("second.thing success", lines[0])
        self.assertIn("{'n': 1}", lines[0])
        out = StringIO()
        call_command("audit", "--action", "first.thing", stdout=out)
        self.assertEqual(len(out.getvalue().splitlines()), 1)


class AuditedFlowTests(TestCase):
    """Exit criterion: 100% of sign-in, sign-out, failed sign-in, switch and invitation events are audited."""

    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def setUp(self):
        AuditEntry.objects.all()  # entries from the set-up stay; tests compare what they add
        self.start = AuditEntry.objects.order_by("-id").values_list("id", flat=True).first() or 0
        self.client = APIClient()

    def new(self, **filters) -> list[str]:
        return actions(id__gt=self.start, **filters)

    def login(self, email: str, password: str = PASSWORD):
        return self.client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")

    def test_sign_in_failed_sign_in_and_sign_out(self):
        director = self.golden.users["director"]
        self.assertEqual(self.login("director@golden.test", "wrong-password").status_code, 400)
        self.assertEqual(self.login("nobody@golden.test", "wrong-password").status_code, 400)
        self.assertEqual(self.login("director@golden.test").status_code, 200)
        self.client.post("/api/v1/auth/logout/", {}, format="json")
        self.assertEqual(
            self.new(),
            [
                "auth.sign_in_failed",
                "auth.sign_in_failed",
                "auth.sign_in",
                "workspace.context_activated",
                "auth.sign_out",
            ],
        )
        failed = AuditEntry.objects.filter(id__gt=self.start, action="auth.sign_in_failed").order_by("id")
        self.assertEqual([e.actor_id for e in failed], [director.public_id, None])  # unknown address: no actor
        self.assertEqual({e.outcome for e in failed}, {"failed"})
        activated = AuditEntry.objects.get(id__gt=self.start, action="workspace.context_activated")
        riverside = self.golden.organizations["riverside"]
        self.assertEqual((activated.organization_id, activated.role), (riverside.public_id, "competition_director"))
        sign_out = AuditEntry.objects.get(id__gt=self.start, action="auth.sign_out")
        self.assertEqual(sign_out.organization_id, riverside.public_id)

    def test_switching_and_losing_a_workspace(self):
        undecided = self.golden.users["undecided"]
        self.client.force_login(undecided)
        club_b = self.golden.organizations["club_b"]
        self.client.put("/api/v1/me/context/", {"context": str(club_b.public_id)}, format="json")
        org_services.set_membership_status(user=undecided, organization=club_b, status_value="revoked")
        self.assertEqual(self.client.get("/api/v1/me/context/").status_code, 403)
        self.assertEqual(
            self.new(),
            ["auth.sign_in", "workspace.context_activated", "membership.status_changed", "workspace.context_ended"],
        )
        ended = AuditEntry.objects.get(id__gt=self.start, action="workspace.context_ended")
        self.assertEqual((ended.actor_id, ended.target_id), (undecided.public_id, str(club_b.public_id)))

    def test_invitation_lifecycle_including_refusals(self):
        club_a = self.golden.organizations["club_a"]
        invitation, token = org_services.create_invitation(
            organization=club_a, email="newbie@golden.test", role="club_coordinator"
        )
        org_services.create_invitation(organization=club_a, email="newbie@golden.test", role="club_coordinator")
        newbie = User.objects.create_user("newbie@golden.test", PASSWORD)
        other = self.golden.users["club_b"]
        with self.assertRaises(ApiError):
            org_services.accept_invitation(token=token, user=newbie)  # replaced: invalid
        _, fresh = org_services.create_invitation(
            organization=club_a, email="newbie@golden.test", role="club_coordinator"
        )
        with self.assertRaises(ApiError):
            org_services.accept_invitation(token=fresh, user=other)  # wrong account
        org_services.accept_invitation(token=fresh, user=newbie)
        self.assertEqual(
            self.new(action__startswith="invitation."),
            [
                "invitation.created",
                "invitation.revoked",
                "invitation.created",
                "invitation.accept_refused",
                "invitation.revoked",
                "invitation.created",
                "invitation.accept_refused",
                "invitation.accepted",
            ],
        )
        refusals = AuditEntry.objects.filter(id__gt=self.start, action="invitation.accept_refused").order_by("id")
        self.assertEqual([e.details["code"] for e in refusals], ["invitation_invalid", "invitation_email_mismatch"])
        self.assertEqual({e.outcome for e in refusals}, {"denied"})
        self.assertEqual(refusals[0].target_id, str(invitation.public_id))

    def test_organization_changes(self):
        league = org_services.create_organization(name="Harbor League", kind="organizer")
        org_services.verify_organization(league)
        org_services.suspend_organization(league)
        org_services.reinstate_organization(league)
        self.assertEqual(
            self.new(target_id=str(league.public_id)),
            ["organization.created", "organization.verified", "organization.suspended", "organization.reinstated"],
        )

    def test_account_events_and_no_personal_data(self):
        client = APIClient()
        client.post(
            "/api/v1/auth/register/",
            {"full_name": "Nia Newbie", "email": "nia@golden.test", "password": "Fresh-Pitch-2026!"},
            format="json",
        )
        nia = User.objects.get(email="nia@golden.test")
        client.post(
            "/api/v1/auth/verify-email/",
            {"uid": encode_uid(nia), "token": email_verification_token.make_token(nia)},
            format="json",
        )
        nia.refresh_from_db()
        client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "uid": encode_uid(nia),
                "token": password_reset_token.make_token(nia),
                "new_password": "Another-Pitch-27!",
            },
            format="json",
        )
        self.assertEqual(
            self.new(actor_id=nia.public_id),
            ["account.registered", "account.email_verified", "account.password_changed"],
        )
        self.assertTrue(mail.outbox)
        for entry in AuditEntry.objects.all():
            text = f"{entry.target_id} {entry.details} {entry.role}"
            self.assertNotIn("@", text, entry.action)

    @patch("accounts.views.logger")
    def test_refused_sign_in_for_unverified_account_is_audited(self, _logger):
        User.objects.create_user("pending@golden.test", PASSWORD, is_active=False)
        self.assertEqual(self.login("pending@golden.test").status_code, 403)
        self.assertEqual(self.new(), ["auth.sign_in_failed"])
