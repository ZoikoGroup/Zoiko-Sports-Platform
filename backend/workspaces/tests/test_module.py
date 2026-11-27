"""GET /api/v1/organizer/venues/: the Venues & Readiness screen endpoint (P12.1)."""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase

from access.tests.golden import Golden, build_golden
from readiness import services
from readiness.services import CheckSpec
from readiness.tests.fixtures import NOW, SHARED, GoldenReadiness, accept, build_golden_readiness, schedule

URL = "/api/v1/organizer/venues/"


class VenuesScreenTests(TestCase):
    golden: Golden
    ready: GoldenReadiness

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        cls.ready = build_golden_readiness(cls.golden)
        # A second venue, fully ready, in Europe.
        harbour = services_venue(cls.golden)
        _, event = schedule(
            cls.golden,
            name="Group Stage",
            venue=harbour,
            region="europe",
            time_zone="Europe/London",
            city="Bristol",
            country="GB",
            starts_at=NOW + timedelta(days=12),
        )
        readiness, _ = services.open_readiness(
            event=event, checks=[CheckSpec("Stadium safety certificate", critical=True)]
        )
        accept(readiness.checks.get(), NOW - timedelta(hours=1))

    def get(self, actor: str = "director"):
        with patch("readiness.selectors.timezone.now", return_value=NOW):
            return self.golden.client(actor).get(URL)

    def test_one_read_fills_the_whole_page(self):
        response = self.get()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data["generated_at"], "2027-06-10T16:00:00Z")
        self.assertEqual(data["summary"], {"total": 2, "ready": 1, "pending_review": 1, "needs_attention": 0})

        first, second = data["venues"]
        self.assertEqual(first["venue"], "Northfield Arena")
        self.assertEqual(first["event"], "Opening Round")
        self.assertEqual(first["competition"], "Opening Round Cup")
        self.assertEqual((first["city"], first["country"], first["region"]), ("Sacramento", "US", "north_america"))
        self.assertEqual((first["time_zone"], first["status"]), ("America/Los_Angeles", "pending_review"))
        self.assertEqual(first["checks"], {"complete": 0, "total": 14})
        self.assertEqual(len(first["check_list"]), 14)
        self.assertEqual(
            first["check_list"][0],
            {"id": first["check_list"][0]["id"], "title": SHARED[0], "state": "pending", "label": "Open"},
        )
        self.assertIsNone(first["issue"])
        self.assertEqual(
            (second["venue"], second["status"], second["evidence_items"]), ("Harbour Point Stadium", "ready", 1)
        )

        self.assertEqual(data["attention"], [])
        self.assertEqual(
            [(a["kind"], a["venue"], a["time_zone"]) for a in data["activity"]],
            [("completed", "Harbour Point Stadium", "Europe/London")],
        )
        self.assertEqual(
            data["regions"],
            [{"region": "europe", "ready": 1, "total": 1}, {"region": "north_america", "ready": 0, "total": 1}],
        )

    def test_attention_items_point_at_their_readiness(self):
        check = self.ready.check(SHARED[0])
        services.submit_evidence(check, title="Certificate", at=NOW - timedelta(days=1))
        services.review_check(check, accepted=False, note="Expired.", at=NOW - timedelta(days=1))
        data = self.get().json()
        self.assertEqual(data["summary"]["needs_attention"], 1)
        [item] = data["attention"]
        self.assertEqual(item["readiness_id"], str(self.ready.readiness.public_id))
        self.assertEqual((item["severity"], item["venue"]), ("high", "Northfield Arena"))
        self.assertEqual(data["venues"][0]["issue"], f"{SHARED[0]}: changes requested (Expired.)")

    def test_only_the_organizers_leads_may_read_it(self):
        self.assertEqual(self.get("coordinator").status_code, 200)
        for actor, code in [
            ("officials", "permission_denied"),
            ("club_c", "permission_denied"),
            ("venue_staff", "permission_denied"),
        ]:
            with self.subTest(actor=actor):
                response = self.get(actor)
                self.assertEqual((response.status_code, response.json()["error"]["code"]), (403, code))
        self.assertEqual(self.get("anonymous").status_code, 401)
        self.assertEqual(self.get("individual").status_code, 403)


def services_venue(golden: Golden):
    from organizations.services import ensure_organization

    return ensure_organization(name="Harbour Point Stadium", kind="venue", jurisdiction="GB")
