"""Write operations of the competitions module (the public write interface).

Provisional subset of P5 (D-047): creating competitions and scheduling their
events, used by venue readiness (P12.1), the demo seed and tests. There are no
HTTP endpoints for these yet (P5.4 to P5.6).

- Only an active organizer organization can own a competition; only an active
  venue organization can host an event.
- Each operation runs in one transaction with its audit entry (P3) and its event
  (P4), so the change, its audit record and its event commit or roll back together.
- Other modules call these functions; they never import this module's models.
"""

import re
from datetime import datetime
from typing import Any

from django.db import transaction

from audit.services import record
from outbox.services import publish
from platform_core.errors import ApiError
from platform_core.timeutils import InvalidTimeZoneError, get_time_zone, to_utc

from . import events
from .models import Competition, Event

SPORT_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
COUNTRY_PATTERN = re.compile(r"^[A-Z]{2}$")


def _invalid(field: str, message: str) -> ApiError:
    return ApiError("validation_error", message, fields={field: [message]})


def _require_organization(organization: Any, kind: str, field: str) -> None:
    if getattr(organization, "kind", None) != kind or getattr(organization, "status", None) != "active":
        raise _invalid(field, f"Choose an active {kind} organization.")


def _name(value: str) -> str:
    name = (value or "").strip()
    if not name or len(name) > 200:
        raise _invalid("name", "Enter a name of up to 200 characters.")
    return name


# --- Competitions ---------------------------------------------------------------


def create_competition(*, organization: Any, name: str, sport: str, actor: Any = None) -> Competition:
    """A new active competition owned by `organization` (an active organizer)."""
    _require_organization(organization, "organizer", "organization")
    name = _name(name)
    sport = (sport or "").strip().lower()
    if not SPORT_PATTERN.match(sport):
        raise _invalid("sport", "Use a sport code such as football.")
    with transaction.atomic():
        competition = Competition.objects.create(organization=organization, name=name, sport=sport)
        record(
            "competition.created",
            actor=actor,
            target=("competition", competition.public_id),
            details={"organization": str(organization.public_id), "sport": sport},
        )
        publish(
            events.COMPETITION_CREATED,
            {
                "competition_id": str(competition.public_id),
                "organization_id": str(organization.public_id),
                "sport": sport,
            },
            aggregate=("competition", competition.public_id),
            aggregate_version=competition.version,
            organization_id=organization.public_id,
        )
    return competition


def ensure_competition(*, organization: Any, name: str, sport: str) -> Competition:
    """The organizer's competition with this name, created if missing (demo data and fixtures)."""
    existing = Competition.objects.filter(organization=organization, name=name.strip()).order_by("pk").first()
    return existing or create_competition(organization=organization, name=name, sport=sport)


# --- Events ---------------------------------------------------------------------


def schedule_event(
    *,
    competition: Competition,
    name: str,
    venue: Any,
    city: str,
    country: str,
    region: str,
    time_zone: str,
    starts_at: datetime,
    actor: Any = None,
) -> Event:
    """A new scheduled event of `competition`, hosted by `venue` (an active venue organization)."""
    _require_organization(venue, "venue", "venue")
    name = _name(name)
    city = (city or "").strip()
    if not city or len(city) > 100:
        raise _invalid("city", "Enter the city, up to 100 characters.")
    country = (country or "").strip().upper()
    if not COUNTRY_PATTERN.match(country):
        raise _invalid("country", "Use a two-letter ISO 3166 country code such as GB.")
    if region not in Event.Region.values:
        raise _invalid("region", f"Choose one of: {', '.join(Event.Region.values)}.")
    try:
        get_time_zone(time_zone)
    except InvalidTimeZoneError as exc:
        raise _invalid("time_zone", str(exc)) from exc
    try:
        starts_at = to_utc(starts_at)
    except ValueError as exc:
        raise _invalid("starts_at", "Give the start time with its UTC offset.") from exc

    with transaction.atomic():
        event = Event.objects.create(
            competition=competition,
            name=name,
            venue=venue,
            city=city,
            country=country,
            region=region,
            time_zone=time_zone,
            starts_at=starts_at,
        )
        organization_id = competition.organization.public_id
        record(
            "event.scheduled",
            actor=actor,
            target=("event", event.public_id),
            details={"competition": str(competition.public_id), "venue": str(venue.public_id)},
        )
        publish(
            events.EVENT_SCHEDULED,
            {
                "event_id": str(event.public_id),
                "competition_id": str(competition.public_id),
                "organization_id": str(organization_id),
                "venue_id": str(venue.public_id),
                "starts_at": starts_at,
            },
            aggregate=("event", event.public_id),
            aggregate_version=event.version,
            organization_id=organization_id,
        )
    return event


def ensure_event(*, competition: Competition, name: str, **details: Any) -> Event:
    """The competition's event with this name, scheduled if missing (demo data and fixtures)."""
    existing = Event.objects.filter(competition=competition, name=name.strip()).order_by("pk").first()
    return existing or schedule_event(competition=competition, name=name, **details)
