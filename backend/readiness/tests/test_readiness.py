"""P12.1 venue readiness: checklist states, what the organizer sees, and update requests."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.test import TestCase

from access.selectors import can
from access.tests.golden import Golden, build_golden
from activity.models import ActivityEntry
from audit.models import AuditEntry
from outbox.models import OutboxEvent
from outbox.worker import deliver_due
from platform_core.errors import ApiError
from platform_core.workspace import WorkspaceContext
from readiness import selectors, services
from readiness.models import ReadinessCheck, UpdateRequest
from readiness.services import CheckSpec

from .fixtures import (
    NOW,
    PRIVATE,
    SHARED,
    GoldenReadiness,
    accept,
    build_golden_readiness,
    other_organizer,
    schedule,
)


def contexts(golden: Golden) -> dict[str, WorkspaceContext]:
    """Workspace contexts of the golden actors, as the middleware builds them."""
    from organizations.selectors import eligible_contexts

    return {
        actor: next(c for c in eligible_contexts(golden.users[actor]) if not c.is_individual)
        for actor in ("director", "coordinator", "officials", "club_c", "venue_staff")
    }


class ChecklistStateTests(TestCase):
    golden: Golden
    ready: GoldenReadiness

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        cls.ready = build_golden_readiness(cls.golden)

    def test_opening_twice_returns_the_existing_checklist(self):
        again, created = services.open_readiness(event=self.ready.event, checks=[CheckSpec("Anything")])
        self.assertFalse(created)
        self.assertEqual(again, self.ready.readiness)
        self.assertEqual(self.ready.readiness.checks.count(), 16)
        opened = OutboxEvent.objects.get(type="readiness.opened")
        self.assertEqual((opened.payload["checks"], opened.payload["shared_checks"]), (16, 14))
        self.assertEqual(opened.organization_id, self.golden.organizations["riverside"].public_id)

    def test_a_checklist_needs_valid_checks(self):
        _, event = schedule(self.golden, name="Second Round")
        for checks in ([], [CheckSpec(" ")], [CheckSpec("x" * 201)], [CheckSpec("A")] * 101):
            with self.subTest(count=len(checks)), self.assertRaises(ApiError):
                services.open_readiness(event=event, checks=checks)

    def test_open_submitted_accepted_or_sent_back(self):
        check = self.ready.check(SHARED[1])
        evidence = services.submit_evidence(check, title="Inspection report", at=NOW)
        self.assertEqual(evidence.check_item, check)
        check.refresh_from_db()
        self.assertEqual((check.state, check.submitted_at), ("submitted", NOW))

        with self.assertRaises(ApiError) as raised:
            services.review_check(check, accepted=False)
        self.assertEqual(raised.exception.fields, {"note": ["Say what the venue should change."]})
        services.review_check(check, accepted=False, note="The report is unsigned.", at=NOW)
        check.refresh_from_db()
        self.assertEqual((check.state, check.note), ("changes_requested", "The report is unsigned."))

        # Resubmitting clears the reviewer's note; accepting ends the check.
        services.submit_evidence(check, title="Signed report", at=NOW + timedelta(hours=1))
        check.refresh_from_db()
        self.assertEqual((check.state, check.note, check.reviewed_at), ("submitted", "", None))
        services.review_check(check, accepted=True, note="ignored", at=NOW + timedelta(hours=2))
        check.refresh_from_db()
        self.assertEqual((check.state, check.note), ("accepted", ""))
        with self.assertRaises(ApiError) as raised:
            services.submit_evidence(check, title="More")
        self.assertEqual(raised.exception.code, "check_already_accepted")
        with self.assertRaises(ApiError) as raised:
            services.review_check(check, accepted=True)
        self.assertEqual(raised.exception.code, "check_not_submitted")

        actions = list(
            AuditEntry.objects.filter(target_id=str(check.public_id)).order_by("id").values_list("action", flat=True)
        )
        self.assertEqual(actions, ["readiness.check_submitted", "readiness.check_reviewed"] * 2)
        reviewed = OutboxEvent.objects.filter(type="readiness.check_reviewed").latest("id")
        self.assertEqual(reviewed.organization_id, self.golden.organizations["northfield"].public_id)
        self.assertEqual(reviewed.payload["state"], "accepted")

    def test_review_notes_and_titles_have_limits(self):
        check = self.ready.check(SHARED[2])
        services.submit_evidence(check, title="Plan", at=NOW)
        with self.assertRaises(ApiError):
            services.review_check(check, accepted=False, note="x" * 301)
        with self.assertRaises(ApiError):
            services.submit_evidence(check, title="")

    def test_the_database_keeps_states_consistent(self):
        check = self.ready.check(SHARED[3])
        cases: list[dict[str, Any]] = [
            {"state": "approved"},
            {"state": "submitted"},
            {"state": "accepted", "submitted_at": NOW},
        ]
        for values in cases:
            with self.subTest(values=values), self.assertRaises(IntegrityError), transaction.atomic():
                ReadinessCheck.objects.filter(pk=check.pk).update(**values)


class BoardTests(TestCase):
    """What the organizer's page is built from (readiness.selectors.board)."""

    golden: Golden
    ready: GoldenReadiness
    contexts: dict[str, WorkspaceContext]

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        cls.ready = build_golden_readiness(cls.golden)
        cls.contexts = contexts(cls.golden)

    def board(self, actor: str = "director", now: datetime = NOW):
        return selectors.board(self.contexts[actor], now=now)

    def test_the_organizer_sees_only_the_fourteen_shared_checks(self):
        board = self.board()
        [row] = board.rows
        self.assertEqual(len(row.checks), 14)
        titles = {c.title for c in row.checks}
        self.assertEqual(titles, set(SHARED))
        self.assertFalse(titles & set(PRIVATE))
        # The private check's evidence is not counted either.
        self.assertEqual(row.evidence_items, 0)
        self.assertEqual((row.status, row.complete, row.issue), ("pending_review", 0, None))

    def test_ready_when_every_shared_check_is_accepted(self):
        for title in SHARED:
            accept(self.ready.check(title), NOW - timedelta(days=2))
        [row] = self.board().rows
        self.assertEqual((row.status, row.complete, row.evidence_items), ("ready", 14, 14))
        self.assertEqual([(r.region, r.ready, r.total) for r in self.board().regions], [("north_america", 1, 1)])

    def test_needs_attention_for_changes_requested_or_overdue_critical_first(self):
        overdue = self.ready.check(SHARED[5])
        ReadinessCheck.objects.filter(pk=overdue.pk).update(due_at=NOW - timedelta(hours=1))
        critical = self.ready.check(SHARED[0])
        services.submit_evidence(critical, title="Certificate", at=NOW - timedelta(days=1))
        services.review_check(critical, accepted=False, note="Expired.", at=NOW - timedelta(days=1))

        board = self.board()
        [row] = board.rows
        self.assertEqual(row.status, "needs_attention")
        self.assertEqual(row.issue, f"{SHARED[0]}: changes requested (Expired.)")
        self.assertEqual(
            [(a.detail, a.severity) for a in board.attention],
            [(f"{SHARED[0]}: changes requested (Expired.)", "high"), (f"{SHARED[5]} is overdue", "medium")],
        )
        labels = {c.title: (c.state, c.label) for c in row.checks}
        self.assertEqual(labels[SHARED[5]], ("attention", "Overdue"))
        self.assertEqual(labels[SHARED[1]], ("pending", "Open"))

    def test_todays_activity_is_today_in_the_events_time_zone(self):
        # 16:00 UTC is 09:00 in Sacramento: 08:00 UTC (01:00 local) is today, 06:00 UTC (23:00 local) is yesterday.
        accept(self.ready.check(SHARED[0]), datetime(2027, 6, 10, 8, 0, tzinfo=UTC))
        accept(self.ready.check(SHARED[1]), datetime(2027, 6, 10, 6, 0, tzinfo=UTC))
        services.submit_evidence(self.ready.check(SHARED[2]), title="Plan", at=NOW - timedelta(minutes=30))
        ReadinessCheck.objects.filter(pk=self.ready.check(SHARED[3]).pk).update(due_at=NOW + timedelta(hours=5))
        # The private check, even when submitted today, never appears.
        services.submit_evidence(self.ready.check(PRIVATE[1]), title="Contracts", at=NOW)

        activity = self.board().activity
        self.assertEqual(
            [(a.kind, a.summary) for a in activity],
            [
                ("scheduled", f"Due today: {SHARED[3]}"),
                ("in_progress", f"Evidence submitted for review: {SHARED[2]}"),
                ("completed", f"Readiness check completed: {SHARED[0]}"),
            ],
        )
        self.assertTrue(all(a.time_zone == "America/Los_Angeles" for a in activity))

    def test_a_venue_sharing_nothing_is_pending_without_checks(self):
        _, event = schedule(self.golden, name="Private Round", region="europe", time_zone="Europe/London")
        services.open_readiness(event=event, checks=[CheckSpec("Internal only", shared=False)])
        rows = {row.record.event.name: row for row in self.board().rows}
        self.assertEqual((rows["Private Round"].status, rows["Private Round"].checks), ("pending_review", []))

    def test_other_organizations_see_nothing(self):
        self.assertEqual(self.board("club_c").rows, [])
        self.assertEqual(self.board("venue_staff").rows, [])
        # Another organizer, even with its own event at the same venue, sees only its own.
        elsewhere = other_organizer(self.golden)
        _, event = schedule(self.golden, name="Elsewhere Final", organizer=elsewhere)
        services.open_readiness(event=event, checks=[CheckSpec("Floodlights")])
        names = [row.record.event.name for row in self.board().rows]
        self.assertEqual(names, ["Opening Round"])
        self.assertIsNone(selectors.readiness_record(self.contexts["club_c"], self.ready.readiness.public_id))
        self.assertIsNone(selectors.board(None).rows or None)

    def test_cancelled_events_leave_the_queue(self):
        from competitions.models import Event

        Event.objects.filter(pk=self.ready.event.pk).update(status="cancelled")
        self.assertEqual(self.board().rows, [])

    def test_check_titles_for_consumers(self):
        check = self.ready.check(SHARED[0])
        self.assertEqual(selectors.check_titles([str(check.public_id), "nope"]), {str(check.public_id): SHARED[0]})

    def test_the_policy_engine_lets_only_the_organizers_leads_request_updates(self):
        readiness = self.ready.readiness
        self.assertTrue(can(self.contexts["director"], "readiness.request_update", readiness))
        self.assertTrue(can(self.contexts["coordinator"], "readiness.request_update", readiness))
        self.assertFalse(can(self.contexts["officials"], "readiness.request_update", readiness))
        self.assertFalse(can(self.contexts["venue_staff"], "readiness.view", readiness))


class UpdateRequestApiTests(TestCase):
    golden: Golden
    ready: GoldenReadiness

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        cls.ready = build_golden_readiness(cls.golden)

    def url(self, readiness_id=None) -> str:
        return f"/api/v1/venue-readiness/{readiness_id or self.ready.readiness.public_id}/update-requests/"

    def post(self, actor: str, body: dict, *, key: str | None = None, readiness_id=None):
        headers = {"Idempotency-Key": key or str(uuid4())}
        return self.golden.client(actor).post(self.url(readiness_id), body, format="json", headers=headers)

    def test_the_organizer_asks_and_the_venue_sees_it_in_its_feed(self):
        deliver_due()
        ActivityEntry.objects.all().delete()
        response = self.post("director", {"message": "  Upload the renewed certificate.  "})
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["message"], "Upload the renewed certificate.")
        self.assertEqual(body["readiness_id"], str(self.ready.readiness.public_id))
        update = UpdateRequest.objects.get(public_id=body["id"])
        self.assertEqual(update.requested_by_organization, self.golden.organizations["riverside"])

        # Audited and published without the free-text message.
        entry = AuditEntry.objects.get(action="readiness.update_requested")
        self.assertEqual(entry.details, {"request": body["id"]})
        event = OutboxEvent.objects.get(type="readiness.update_requested")
        self.assertNotIn("message", event.payload)
        self.assertEqual(event.organization_id, self.golden.organizations["northfield"].public_id)

        deliver_due()
        northfield = ActivityEntry.objects.filter(organization_id=self.golden.organizations["northfield"].public_id)
        self.assertEqual(
            list(northfield.values_list("summary", flat=True)),
            ["Riverside Invitational asked for a readiness update for Opening Round."],
        )
        self.assertFalse(ActivityEntry.objects.filter(organization_id=self.golden.organizations["riverside"].public_id))

    def test_a_retry_with_the_same_key_does_not_ask_twice(self):
        key = str(uuid4())
        first = self.post("coordinator", {"message": "Please update."}, key=key)
        again = self.post("coordinator", {"message": "Please update."}, key=key)
        self.assertEqual((first.status_code, again.status_code), (201, 201))
        self.assertEqual(again["Idempotent-Replayed"], "true")
        self.assertEqual(UpdateRequest.objects.count(), 1)
        missing = self.golden.client("director").post(self.url(), {"message": "x"}, format="json")
        self.assertEqual(missing.json()["error"]["code"], "idempotency_key_required")

    def test_messages_are_required_and_limited(self):
        for message, status in [("   ", 400), ("x" * 501, 400), ("x" * 500, 201)]:
            with self.subTest(length=len(message)):
                response = self.post("director", {"message": message})
                self.assertEqual(response.status_code, status, response.content)
                if status == 400:
                    self.assertIn("message", response.json()["error"]["fields"])

    def test_refusals_hide_other_organizers_readiness(self):
        self.assertEqual(self.post("director", {"message": "x"}, readiness_id=uuid4()).status_code, 404)
        elsewhere = other_organizer(self.golden)
        _, event = schedule(self.golden, name="Elsewhere Final", organizer=elsewhere)
        theirs, _ = services.open_readiness(event=event, checks=[CheckSpec("Floodlights")])
        response = self.post("director", {"message": "x"}, readiness_id=theirs.public_id)
        self.assertEqual((response.status_code, response.json()["error"]["code"]), (404, "not_found"))
        for actor in ("officials", "club_c", "venue_staff"):
            with self.subTest(actor=actor):
                response = self.post(actor, {"message": "x"})
                self.assertEqual((response.status_code, response.json()["error"]["code"]), (403, "permission_denied"))
        self.assertEqual(self.golden.client("anonymous").post(self.url(), {}, format="json").status_code, 401)
        self.assertEqual(UpdateRequest.objects.count(), 0)

    def test_a_role_that_loses_the_permission_on_a_visible_record_gets_403(self):
        from access.services import revoke_permission

        revoke_permission("competition_director", "readiness.request_update")
        response = self.post("director", {"message": "x"})
        self.assertEqual((response.status_code, response.json()["error"]["code"]), (403, "permission_denied"))
