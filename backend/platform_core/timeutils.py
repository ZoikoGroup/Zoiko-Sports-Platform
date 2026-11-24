"""Time handling: UTC storage, IANA time zones and local-time conversion.

- Instants are stored and exchanged in UTC (USE_TZ = True, TIME_ZONE = "UTC");
  the API writes them as RFC 3339 with "Z", for example 2027-06-12T18:00:00Z.
- A record that happens somewhere carries an IANA time-zone name ("Europe/London")
  so local dates and times can be shown and entered.
- Converting a local wall-clock time to UTC must handle daylight saving:
    * gap: the time never happens (clocks jump forward, for example 01:30 on
      29 March 2026 in Europe/London) -> NonexistentLocalTimeError;
    * overlap: the time happens twice (clocks go back, for example 01:30 on
      25 October 2026 in Europe/London) -> AmbiguousLocalTimeError unless the
      caller chooses "earlier" or "later".
  Rejecting both is the default policy (decision log); the frontend's local-time
  conversion must follow the same policy.
"""

import re
from datetime import UTC, date, datetime, time
from enum import StrEnum
from functools import cache
from zoneinfo import ZoneInfo, available_timezones

# Canonical IANA names are Area/Location (one or two further levels allowed, as in
# America/Argentina/Buenos_Aires), plus "UTC". Legacy aliases ("EST", "US/Eastern")
# and the Etc/GMT±N zones (whose sign is inverted) are not accepted.
_CANONICAL = re.compile(
    r"(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)/[A-Za-z0-9_+\-/]+"
)


class InvalidTimeZoneError(ValueError):
    pass


class NonexistentLocalTimeError(ValueError):
    pass


class AmbiguousLocalTimeError(ValueError):
    pass


class Ambiguity(StrEnum):
    REJECT = "reject"
    EARLIER = "earlier"
    LATER = "later"


@cache
def supported_time_zones() -> frozenset[str]:
    return frozenset(name for name in available_timezones() if name == "UTC" or _CANONICAL.fullmatch(name))


def get_time_zone(name: str) -> ZoneInfo:
    """The ZoneInfo for a supported IANA name; InvalidTimeZoneError otherwise."""
    if not isinstance(name, str) or name not in supported_time_zones():
        raise InvalidTimeZoneError(f"{name!r} is not a supported IANA time zone (for example Europe/London).")
    return ZoneInfo(name)


def _require_aware(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("A timezone-aware datetime is required.")


def to_utc(value: datetime) -> datetime:
    _require_aware(value)
    return value.astimezone(UTC)


def to_local(value: datetime, time_zone: str) -> datetime:
    """The same instant as wall-clock time in `time_zone`."""
    _require_aware(value)
    return value.astimezone(get_time_zone(time_zone))


def local_to_utc(
    local_date: date, local_time: time, time_zone: str, *, ambiguous: Ambiguity = Ambiguity.REJECT
) -> datetime:
    """The UTC instant of a local wall-clock time, with explicit daylight-saving handling."""
    if local_time.tzinfo is not None:
        raise ValueError("local_time must be a wall-clock time without tzinfo.")
    zone = get_time_zone(time_zone)
    naive = datetime.combine(local_date, local_time)
    first = naive.replace(tzinfo=zone, fold=0)
    second = naive.replace(tzinfo=zone, fold=1)

    # In a gap the wall time does not round-trip: converting to UTC and back
    # lands on a different wall time.
    if first.astimezone(UTC).astimezone(zone).replace(tzinfo=None) != naive:
        raise NonexistentLocalTimeError(
            f"{naive:%Y-%m-%d %H:%M} doesn't exist in {time_zone}: the clocks go forward at that time."
        )
    if first.utcoffset() != second.utcoffset():
        if ambiguous == Ambiguity.EARLIER:
            return first.astimezone(UTC)
        if ambiguous == Ambiguity.LATER:
            return second.astimezone(UTC)
        raise AmbiguousLocalTimeError(
            f"{naive:%Y-%m-%d %H:%M} happens twice in {time_zone}: the clocks go back at that time. "
            "Choose the earlier or the later occurrence."
        )
    return first.astimezone(UTC)
