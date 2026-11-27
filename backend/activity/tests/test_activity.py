"""P4.4: the activity feed, built from events, scoped to the organization it concerns."""

from uuid import uuid4

from django.test import TestCase
from django.utils import timezone

from access.tests.golden import PASSWORD, Golden, build_golden
from accounts.models import User
from activity import services
from activity.models import ActivityEntry
from organizations import services as org_services
from outbox.models import OutboxEvent
from outbox.services import DeliveredEvent, replay
from outbox.worker import deliver_due


def summaries(organization) -> list[str]:
    return list(
        ActivityEntry.objects.filter(organization_id=organization.public_id)
        .order_by("occurred_at", "id")
        .values_list("summary", flat=True)
    )


class FeedConsumerTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def setUp(self):
        deliver_due()  # entries from the golden set-up
        ActivityEntry.objects.all().delete()

    def test_every_organization_event_becomes_a_readable_line(self):
        club_a = self.golden.organizations["club_a"]
        org_services.create_invitation(organization=club_a, email="newbie@golden.test", role="club_coordinator")
        _, token = org_services.create_invitation(
            organization=club_a, email="newbie@golden.test", role="club_coordinator"
        )
        newbie = User.objects.create_user("newbie@golden.test", PASSWORD, full_name="Nia Newbie")
        org_services.accept_invitation(token=token, user=newbie)
        org_services.set_membership_status(user=newbie, organization=club_a, status_value="suspended")
        org_services.set_membership_status(user=newbie, organization=club_a, status_value="active")
        org_services.set_membership_status(user=newbie, organization=club_a, status_value="revoked")
        org_services.grant_membership(user=newbie, organization=club_a, role="organization_access_manager")
        league = org_services.create_organization(name="Harbor League", kind="organizer")
        org_services.verify_organization(league)
        org_services.suspend_organization(league)
        org_services.reinstate_organization(league)
        deliver_due()

        self.assertEqual(
            summaries(club_a),
            [
                "An invitation to join Club A as Club coordinator was sent.",
                "An invitation to join Club A was withdrawn.",
                "An invitation to join Club A as Club coordinator was sent.",
                "Nia Newbie joined Club A as Club coordinator.",
                "Nia Newbie's access to Club A was suspended.",
                "Nia Newbie's access to Club A was restored.",
                "Nia Newbie was removed from Club A.",
                "Nia Newbie was added to Club A as Organization access manager.",
            ],
        )
        self.assertEqual(
            summaries(league),
            ["Harbor League was verified.", "Harbor League was suspended.", "Harbor League was reinstated."],
        )
        entry = ActivityEntry.objects.filter(kind="invitation.accepted").get()
        self.assertEqual(entry.target_type, "invitation")

    def test_a_replayed_event_never_creates_a_second_entry(self):
        club_b = self.golden.organizations["club_b"]
        invitation, _ = org_services.create_invitation(
            organization=club_b, email="x@golden.test", role="club_coordinator"
        )
        deliver_due()
        event = OutboxEvent.objects.get(aggregate_id=str(invitation.public_id))
        self.assertEqual(replay(include_done=True, consumer=services.CONSUMER, event_id=event.event_id), 1)
        deliver_due()
        self.assertEqual(ActivityEntry.objects.filter(organization_id=club_b.public_id).count(), 1)

    def test_unknown_people_and_events_without_a_scope(self):
        event = DeliveredEvent(
            id=uuid4(),
            type="membership.granted",
            version=1,
            payload={
                "membership_id": "m",
                "organization_id": str(self.golden.organizations["club_c"].public_id),
                "user_id": "not-a-uuid",
                "role": "club_coordinator",
            },
            aggregate_type="membership",
            aggregate_id="m",
            aggregate_version=None,
            organization_id=self.golden.organizations["club_c"].public_id,
            occurred_at=timezone.now(),
            request_id="",
        )
        services.handle(event)
        self.assertEqual(
            ActivityEntry.objects.get(event_id=event.id).summary, "A member was added to Club C as Club coordinator."
        )
        unscoped = DeliveredEvent(**{**event.__dict__, "id": uuid4(), "organization_id": None})
        services.handle(unscoped)
        self.assertFalse(ActivityEntry.objects.filter(event_id=unscoped.id).exists())


class FeedApiTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        deliver_due()

    def test_members_read_their_organizations_feed_page_by_page(self):
        client = self.golden.client("venue_staff")
        response = client.get("/api/v1/activity/", {"page_size": 1})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"next", "previous", "results"})
        self.assertEqual(len(body["results"]), 1)
        self.assertEqual(set(body["results"][0]), {"id", "occurred_at", "kind", "summary"})
        self.assertIn("Northfield Arena", body["results"][0]["summary"])

    def test_refusals(self):
        anonymous = self.golden.client("anonymous").get("/api/v1/activity/")
        self.assertEqual((anonymous.status_code, anonymous.json()["error"]["code"]), (401, "not_authenticated"))
        legacy = self.golden.client("legacy").get("/api/v1/activity/")
        self.assertEqual((legacy.status_code, legacy.json()["error"]["code"]), (403, "permission_denied"))
        undecided = self.golden.client("undecided").get("/api/v1/activity/")
        self.assertEqual(undecided.json()["error"]["code"], "context_required")
        individual = self.golden.client("individual").get("/api/v1/activity/")
        self.assertEqual(individual.json()["error"]["code"], "permission_denied")

    def test_end_to_end_invitation_to_feed(self):
        club_a = self.golden.organizations["club_a"]
        _, token = org_services.create_invitation(
            organization=club_a, email="ravi@golden.test", role="club_coordinator"
        )
        ravi = User.objects.create_user("ravi@golden.test", PASSWORD, full_name="Ravi Runner")
        org_services.accept_invitation(token=token, user=ravi)
        before = self.golden.client("club_a").get("/api/v1/activity/").json()["results"]
        self.assertNotIn("Ravi Runner joined Club A as Club coordinator.", [e["summary"] for e in before])
        deliver_due()  # the worker's job
        after = self.golden.client("club_a").get("/api/v1/activity/").json()["results"]
        self.assertEqual(after[0]["summary"], "Ravi Runner joined Club A as Club coordinator.")
        club_c = self.golden.client("club_c").get("/api/v1/activity/").json()["results"]
        self.assertNotIn("Ravi Runner", " ".join(e["summary"] for e in club_c))
