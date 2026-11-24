from datetime import UTC, date, datetime, time, timedelta, timezone

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import serializers

from platform_core.fields import AwareDateTimeField, TimeZoneField
from platform_core.timeutils import (
    Ambiguity,
    AmbiguousLocalTimeError,
    InvalidTimeZoneError,
    NonexistentLocalTimeError,
    get_time_zone,
    local_to_utc,
    supported_time_zones,
    to_local,
    to_utc,
)

from .helpers import ITEMS, REFERENCE_URLS, item_payload, make_user, signed_in_client


def utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


# zone, gap day, a time in the gap, overlap day, a time in the overlap,
# UTC of the earlier and later occurrence of that overlapping time.
DST_CASES = [
    ("America/New_York", date(2026, 3, 8), time(2, 30), date(2026, 11, 1), time(1, 30),
     utc(2026, 11, 1, 5, 30), utc(2026, 11, 1, 6, 30)),
    ("Europe/London", date(2026, 3, 29), time(1, 30), date(2026, 10, 25), time(1, 30),
     utc(2026, 10, 25, 0, 30), utc(2026, 10, 25, 1, 30)),
    # Southern hemisphere: clocks go back in April and forward in October.
    ("Australia/Sydney", date(2026, 10, 4), time(2, 30), date(2026, 4, 5), time(2, 30),
     utc(2026, 4, 4, 15, 30), utc(2026, 4, 4, 16, 30)),
]  # fmt: skip


class TimeZoneNameTests(SimpleTestCase):
    def test_canonical_iana_names_are_accepted(self):
        for name in ["Europe/London", "America/New_York", "America/Argentina/Buenos_Aires", "Asia/Kolkata", "UTC"]:
            with self.subTest(name=name):
                self.assertEqual(str(get_time_zone(name)), name)

    def test_aliases_abbreviations_and_unknown_names_are_rejected(self):
        for name in ["EST", "US/Eastern", "Etc/GMT+5", "GMT", "London", "", "Europe/Atlantis", "europe/london", None]:
            with self.subTest(name=name), self.assertRaises(InvalidTimeZoneError):
                get_time_zone(name)  # type: ignore[arg-type]

    def test_the_supported_set_is_large_and_canonical(self):
        zones = supported_time_zones()
        self.assertGreater(len(zones), 300)
        self.assertTrue(all(name == "UTC" or "/" in name for name in zones))


class DaylightSavingTests(SimpleTestCase):
    def test_times_in_a_gap_do_not_exist(self):
        for zone, gap_day, gap_time, *_ in DST_CASES:
            with self.subTest(zone=zone), self.assertRaisesMessage(NonexistentLocalTimeError, zone):
                local_to_utc(gap_day, gap_time, zone)

    def test_times_in_an_overlap_are_ambiguous_unless_a_side_is_chosen(self):
        for zone, _, _, overlap_day, overlap_time, earlier, later in DST_CASES:
            with self.subTest(zone=zone):
                with self.assertRaisesMessage(AmbiguousLocalTimeError, "happens twice"):
                    local_to_utc(overlap_day, overlap_time, zone)
                self.assertEqual(local_to_utc(overlap_day, overlap_time, zone, ambiguous=Ambiguity.EARLIER), earlier)
                self.assertEqual(local_to_utc(overlap_day, overlap_time, zone, ambiguous=Ambiguity.LATER), later)
                self.assertEqual(later - earlier, timedelta(hours=1))

    def test_every_quarter_hour_of_the_transition_days(self):
        """Exactly one hour vanishes on gap days and one repeats on overlap days; all else round-trips."""
        for zone, gap_day, _, overlap_day, *_ in DST_CASES:
            for day, expect_missing, expect_doubled in [(gap_day, 4, 0), (overlap_day, 0, 4)]:
                missing = doubled = 0
                for minutes in range(0, 24 * 60, 15):
                    wall = time(minutes // 60, minutes % 60)
                    try:
                        instant = local_to_utc(day, wall, zone)
                    except NonexistentLocalTimeError:
                        missing += 1
                        continue
                    except AmbiguousLocalTimeError:
                        doubled += 1
                        for side in (Ambiguity.EARLIER, Ambiguity.LATER):
                            back = to_local(local_to_utc(day, wall, zone, ambiguous=side), zone)
                            self.assertEqual((back.date(), back.time()), (day, wall))
                        continue
                    back = to_local(instant, zone)
                    self.assertEqual((back.date(), back.time()), (day, wall), f"{zone} {day} {wall}")
                with self.subTest(zone=zone, day=day):
                    self.assertEqual((missing, doubled), (expect_missing, expect_doubled))

    def test_zones_without_daylight_saving(self):
        # Asia/Kolkata is UTC+05:30 all year: nothing is missing or repeated.
        self.assertEqual(local_to_utc(date(2026, 3, 29), time(1, 30), "Asia/Kolkata"), utc(2026, 3, 28, 20, 0))
        self.assertEqual(local_to_utc(date(2026, 10, 25), time(1, 30), "Asia/Kolkata"), utc(2026, 10, 24, 20, 0))
        self.assertEqual(local_to_utc(date(2026, 3, 8), time(2, 30), "UTC"), utc(2026, 3, 8, 2, 30))

    def test_edges_of_the_london_gap(self):
        self.assertEqual(local_to_utc(date(2026, 3, 29), time(0, 59), "Europe/London"), utc(2026, 3, 29, 0, 59))
        self.assertEqual(local_to_utc(date(2026, 3, 29), time(2, 0), "Europe/London"), utc(2026, 3, 29, 1, 0))
        with self.assertRaises(NonexistentLocalTimeError):
            local_to_utc(date(2026, 3, 29), time(1, 0), "Europe/London")

    def test_naive_and_aware_inputs_are_checked(self):
        with self.assertRaises(ValueError):
            to_local(datetime(2026, 1, 1, 12, 0), "Europe/London")  # noqa: DTZ001 - naive on purpose
        with self.assertRaises(ValueError):
            to_utc(datetime(2026, 1, 1, 12, 0))  # noqa: DTZ001 - naive on purpose
        with self.assertRaises(ValueError):
            local_to_utc(date(2026, 1, 1), time(12, 0, tzinfo=UTC), "Europe/London")
        self.assertEqual(to_utc(datetime(2026, 1, 1, 12, 0, tzinfo=timezone(timedelta(hours=2)))), utc(2026, 1, 1, 10))


class FieldTests(SimpleTestCase):
    class Form(serializers.Serializer):
        starts_at = AwareDateTimeField()
        time_zone = TimeZoneField()

    def validate(self, **data):
        form = self.Form(data=data)
        return form.is_valid(), form.validated_data if form.is_valid() else form.errors

    def test_instants_need_an_offset_and_are_normalised_to_utc(self):
        ok, data = self.validate(starts_at="2027-06-12T20:00:00+02:00", time_zone="Europe/Paris")
        self.assertTrue(ok)
        self.assertEqual(data["starts_at"], utc(2027, 6, 12, 18, 0))
        self.assertEqual(self.Form(data).data["starts_at"], "2027-06-12T18:00:00Z")

    def test_naive_and_malformed_instants_are_rejected(self):
        for value, message in [
            ("2027-06-12T18:00:00", "Include a UTC offset"),
            ("12/06/2027", "RFC 3339"),
            (42, "RFC 3339"),
        ]:
            with self.subTest(value=value):
                ok, errors = self.validate(starts_at=value, time_zone="UTC")
                self.assertFalse(ok)
                self.assertIn(message, str(errors["starts_at"][0]))

    def test_time_zone_field_validates_iana_names(self):
        ok, errors = self.validate(starts_at="2027-06-12T18:00:00Z", time_zone="EST")
        self.assertFalse(ok)
        self.assertIn("valid IANA time zone", str(errors["time_zone"][0]))


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class TimeOverApiTests(TestCase):
    def setUp(self):
        self.client = signed_in_client(make_user())

    def test_offsets_are_stored_and_returned_in_utc(self):
        response = self.client.post(
            ITEMS, item_payload(starts_at="2027-06-12T23:30:00+05:30"), format="json", HTTP_IDEMPOTENCY_KEY="tz-1"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["starts_at"], "2027-06-12T18:00:00Z")
        self.assertTrue(response.json()["created_at"].endswith("Z"))

    def test_invalid_time_values_are_field_errors(self):
        for overrides, field in [
            ({"starts_at": "2027-06-12T18:00:00"}, "starts_at"),
            ({"time_zone": "London"}, "time_zone"),
        ]:
            with self.subTest(field=field):
                response = self.client.post(
                    ITEMS, item_payload(**overrides), format="json", HTTP_IDEMPOTENCY_KEY=f"tz-{field}"
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["error"]["fields"])
