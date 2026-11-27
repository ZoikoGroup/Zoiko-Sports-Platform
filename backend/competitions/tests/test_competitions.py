"""P5.2 provisional subset (D-047): competitions and events, with their audit entries and events."""

from datetime import datetime, timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.test import TestCase

from access.tests.golden import Golden, build_golden
from audit.models import AuditEntry
from competitions import selectors, services
from competitions.models import Competition, Event
from organizations.services import create_organization
from outbox.models import OutboxEvent
from platform_core.errors import ApiError
from readiness.tests.fixtures import NOW


class CompetitionTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def setUp(self):
        self.riverside = self.golden.organizations["riverside"]
        self.northfield = self.golden.organizations["northfield"]

    def error_field(self, raised: ApiError) -> str:
        return next(iter(raised.fields or {}))

    def test_an_organizer_creates_a_competition_audited_and_published(self):
        competition = services.create_competition(organization=self.riverside, name=" Riverside Cup ", sport="Football")
        self.assertEqual(
            (competition.name, competition.sport, competition.status), ("Riverside Cup", "football", "active")
        )
        self.assertEqual(competition.owner_organization_id, self.riverside.pk)
        self.assertTrue(AuditEntry.objects.filter(action="competition.created", target_id=str(competition.public_id)))
        event = OutboxEvent.objects.get(type="competition.created")
        self.assertEqual(event.organization_id, self.riverside.public_id)
        self.assertEqual(event.payload["sport"], "football")

    def test_only_an_active_organizer_owns_a_competition(self):
        pending = create_organization(name="Unverified League", kind="organizer")
        for organization in (self.northfield, pending):
            with self.subTest(organization=organization.name), self.assertRaises(ApiError) as raised:
                services.create_competition(organization=organization, name="Cup", sport="football")
            self.assertEqual(self.error_field(raised.exception), "organization")
        for name, sport, field in [
            ("", "football", "name"),
            ("x" * 201, "football", "name"),
            ("Cup", "Foot ball", "sport"),
        ]:
            with self.subTest(field=field), self.assertRaises(ApiError) as raised:
                services.create_competition(organization=self.riverside, name=name, sport=sport)
            self.assertEqual(self.error_field(raised.exception), field)

    def test_ensure_competition_and_event_create_once(self):
        first = services.ensure_competition(organization=self.riverside, name="Cup", sport="football")
        self.assertEqual(services.ensure_competition(organization=self.riverside, name="Cup", sport="football"), first)
        details = {
            "venue": self.northfield,
            "city": "Sacramento",
            "country": "us",
            "region": "north_america",
            "time_zone": "America/Los_Angeles",
            "starts_at": NOW,
        }
        event = services.ensure_event(competition=first, name="Final", **details)
        self.assertEqual(services.ensure_event(competition=first, name="Final", **details), event)
        self.assertEqual(Event.objects.count(), 1)
        self.assertEqual(Competition.objects.count(), 1)


class EventTests(TestCase):
    golden: Golden
    competition: Competition

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        cls.competition = services.create_competition(
            organization=cls.golden.organizations["riverside"], name="Riverside Cup", sport="football"
        )

    def schedule(self, **overrides):
        details = {
            "competition": self.competition,
            "name": "Opening Round",
            "venue": self.golden.organizations["northfield"],
            "city": "Bristol",
            "country": "gb",
            "region": "europe",
            "time_zone": "Europe/London",
            "starts_at": NOW,
            **overrides,
        }
        return services.schedule_event(**details)

    def test_an_event_is_scheduled_at_a_venue_in_utc(self):
        event = self.schedule(starts_at=datetime.fromisoformat("2027-06-10T19:30:00+01:00"))
        self.assertEqual(event.country, "GB")
        self.assertEqual(event.starts_at.isoformat(), "2027-06-10T18:30:00+00:00")
        self.assertEqual(event.owner_organization_id, self.golden.organizations["riverside"].pk)
        published = OutboxEvent.objects.get(type="event.scheduled")
        self.assertEqual(published.payload["venue_id"], str(self.golden.organizations["northfield"].public_id))
        self.assertEqual(published.payload["starts_at"], "2027-06-10T18:30:00Z")
        self.assertTrue(AuditEntry.objects.filter(action="event.scheduled", target_id=str(event.public_id)))

    def test_invalid_details_are_refused_field_by_field(self):
        cases: dict[str, dict[str, Any]] = {
            "venue": {"venue": self.golden.organizations["club_a"]},
            "name": {"name": " "},
            "city": {"city": ""},
            "country": {"country": "GBR"},
            "region": {"region": "antarctica"},
            "time_zone": {"time_zone": "EST"},
            "starts_at": {"starts_at": datetime(2027, 6, 10, 19, 30)},  # noqa: DTZ001 - deliberately without an offset
        }
        for field, overrides in cases.items():
            with self.subTest(field=field), self.assertRaises(ApiError) as raised:
                self.schedule(**overrides)
            self.assertEqual(next(iter(raised.exception.fields or {})), field)

    def test_the_database_refuses_values_the_services_never_write(self):
        event = self.schedule()
        for column, value in [("region", "mars"), ("country", "gb"), ("status", "postponed")]:
            with self.subTest(column=column), self.assertRaises(IntegrityError), transaction.atomic():
                Event.objects.filter(pk=event.pk).update(**{column: value})

    def test_event_names_for_consumers(self):
        event = self.schedule(starts_at=NOW + timedelta(days=1))
        self.assertEqual(
            selectors.event_names([str(event.public_id), "not-a-uuid"]), {str(event.public_id): "Opening Round"}
        )
