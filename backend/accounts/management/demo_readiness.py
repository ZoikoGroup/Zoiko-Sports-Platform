"""Demo competition, events and venue readiness for seed_demo (fictional; D-047).

Riverside Invitational runs one competition at five venues. Northfield Arena is
the golden event's venue: 16 readiness checks, 14 shared with the organizer and
2 kept private (backend/docs/golden-event.md). The other four venues are extra
fictional organizations so every readiness status and several regions appear.

Everything goes through the owning modules' services (audit entries and events
included). Times are relative to when the seed runs, in each event's time zone,
so "today's activity" is today's. Re-running the seed changes nothing that exists.
"""

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any

from django.utils import timezone

from competitions.services import ensure_competition, ensure_event
from organizations.services import ensure_organization
from platform_core.timeutils import local_to_utc, to_local
from readiness.services import CheckSpec, open_readiness, review_check, submit_evidence

COMPETITION = "Riverside Invitational Cup"

# Check outcomes: open (optionally due in N days), submitted N days ago, accepted N days ago,
# or changes requested. "today" means a few hours ago, so it shows in today's activity.
OPEN, SUBMITTED, ACCEPTED, CHANGES = "open", "submitted", "accepted", "changes"


@dataclass(frozen=True)
class Check:
    title: str
    outcome: str
    days: float = 0  # open: due in N days (negative: overdue); others: N days ago (0 = today)
    critical: bool = False
    shared: bool = True
    note: str = ""


@dataclass(frozen=True)
class Venue:
    name: str
    jurisdiction: str
    event: str
    city: str
    country: str
    region: str
    time_zone: str
    in_days: int
    local_hour: tuple[int, int]
    checks: tuple[Check, ...]


VENUES = (
    Venue(
        "Northfield Arena",
        "US-CA",
        "Riverside Cup: Opening Round",
        "Sacramento",
        "US",
        "north_america",
        "America/Los_Angeles",
        6,
        (19, 0),
        (
            Check("Stadium safety certificate", ACCEPTED, 3, critical=True),
            Check("Fire safety inspection", ACCEPTED, 2, critical=True),
            Check("Emergency evacuation plan", SUBMITTED, 0, critical=True),
            Check("Medical and first-aid cover", ACCEPTED, 0),
            Check("Stewarding plan", SUBMITTED, 1),
            Check("Turnstile and access-control test", OPEN, 3),
            Check("CCTV coverage review", ACCEPTED, 4),
            Check("Pitch condition report", OPEN, 0),
            Check("Floodlight test", ACCEPTED, 2),
            Check("Public address system test", OPEN, 4),
            Check("Accessibility provisions", ACCEPTED, 5),
            Check("Broadcast and media positions", SUBMITTED, 2),
            Check("Team dressing rooms inspection", ACCEPTED, 1),
            Check("Spectator signage", OPEN, 5),
            # The venue's own items: never shown to the organizer.
            Check("Internal staffing roster", OPEN, 2, shared=False),
            Check("Catering supplier contracts", SUBMITTED, 1, shared=False),
        ),
    ),
    Venue(
        "Harbour Point Stadium",
        "GB",
        "Riverside Cup: Group Stage",
        "Bristol",
        "GB",
        "europe",
        "Europe/London",
        13,
        (15, 0),
        (
            Check("Stadium safety certificate", ACCEPTED, 6, critical=True),
            Check("Fire safety inspection", ACCEPTED, 5, critical=True),
            Check("Emergency evacuation plan", ACCEPTED, 4, critical=True),
            Check("Medical and first-aid cover", ACCEPTED, 3),
            Check("Stewarding plan", ACCEPTED, 2),
            Check("Pitch condition report", ACCEPTED, 0),
        ),
    ),
    Venue(
        "Lakeside Park",
        "US-IL",
        "Riverside Cup: Quarter-final",
        "Chicago",
        "US",
        "north_america",
        "America/Chicago",
        9,
        (18, 30),
        (
            Check(
                "Fire safety certificate",
                CHANGES,
                0,
                critical=True,
                note="The certificate on file expired in October; upload the renewed one.",
            ),
            Check("Crowd management plan", OPEN, -1),
            Check("Medical and first-aid cover", ACCEPTED, 2),
            Check("Floodlight test", SUBMITTED, 1),
            Check("CCTV coverage review", ACCEPTED, 3),
            Check("Pitch condition report", OPEN, 4),
        ),
    ),
    Venue(
        "Southern Cross Ground",
        "AU-VIC",
        "Riverside Cup: Exhibition Match",
        "Melbourne",
        "AU",
        "oceania",
        "Australia/Melbourne",
        20,
        (19, 30),
        (
            Check("Stadium safety certificate", ACCEPTED, 2, critical=True),
            Check("Fire safety inspection", SUBMITTED, 1, critical=True),
            Check("Medical and first-aid cover", OPEN, 6),
            Check("Stewarding plan", OPEN, 8),
            Check("Floodlight test", OPEN, 10),
        ),
    ),
    Venue(
        "Bayfront Arena",
        "SG",
        "Riverside Cup: Semi-final",
        "Singapore",
        "SG",
        "asia",
        "Asia/Singapore",
        16,
        (20, 0),
        (
            Check("Stadium safety certificate", ACCEPTED, 4, critical=True),
            Check("Fire safety inspection", ACCEPTED, 3, critical=True),
            Check("Medical and first-aid cover", ACCEPTED, 2),
            Check("Floodlight test", ACCEPTED, 1),
        ),
    ),
)


def _ago(now: datetime, days: float, time_zone: str) -> datetime:
    """`days` ago; 0 means earlier today in the venue's time zone (at most two hours ago)."""
    if days:
        return now - timedelta(days=days)
    midnight = local_to_utc(to_local(now, time_zone).date(), time(0, 0), time_zone)
    return max(midnight, now - timedelta(hours=2))


def _due(now: datetime, days: float, time_zone: str) -> datetime:
    """In `days` days; 0 means later today in the venue's time zone (just before midnight)."""
    if days:
        return now + timedelta(days=days)
    return max(local_to_utc(to_local(now, time_zone).date(), time(23, 59), time_zone), now)


def seed(organizer: Any, organizations: dict[str, Any]) -> list[str]:
    """Create the demo competition, events and readiness; returns the venues set up now."""
    now = timezone.now()
    competition = ensure_competition(organization=organizer, name=COMPETITION, sport="football")
    created = []
    for spec in VENUES:
        venue = organizations.get(spec.name) or ensure_organization(
            name=spec.name, kind="venue", jurisdiction=spec.jurisdiction
        )
        day = to_local(now, spec.time_zone).date() + timedelta(days=spec.in_days)
        event = ensure_event(
            competition=competition,
            name=spec.event,
            venue=venue,
            city=spec.city,
            country=spec.country,
            region=spec.region,
            time_zone=spec.time_zone,
            starts_at=local_to_utc(day, time(*spec.local_hour), spec.time_zone),
        )
        checks = [
            CheckSpec(
                c.title,
                shared=c.shared,
                critical=c.critical,
                due_at=_due(now, c.days, spec.time_zone) if c.outcome == OPEN else None,
            )
            for c in spec.checks
        ]
        readiness, is_new = open_readiness(event=event, checks=checks)
        if not is_new:
            continue
        for check, plan in zip(readiness.checks.order_by("position"), spec.checks, strict=True):
            if plan.outcome == OPEN:
                continue
            when = _ago(now, plan.days, spec.time_zone)
            submitted = when - timedelta(hours=20) if plan.outcome in (ACCEPTED, CHANGES) else when
            submit_evidence(check, title=f"{plan.title}: evidence pack", at=submitted)
            if plan.outcome == ACCEPTED:
                review_check(check, accepted=True, at=when)
            elif plan.outcome == CHANGES:
                review_check(check, accepted=False, note=plan.note, at=when)
        created.append(spec.name)
    return created
