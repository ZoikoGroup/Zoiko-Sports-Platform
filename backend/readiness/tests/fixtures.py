"""Venue readiness on the golden event (backend/docs/golden-event.md, P12.1).

Riverside Invitational's competition has one event at Northfield Arena with the
golden checklist: 16 checks, 14 shared with the organizer and 2 kept private.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from access.tests.golden import Golden
from competitions.services import create_competition, schedule_event
from organizations.services import ensure_organization
from readiness.models import ReadinessCheck, VenueReadiness
from readiness.services import CheckSpec, open_readiness, review_check, submit_evidence

# A fixed "now" keeps every date rule deterministic.
NOW = datetime(2027, 6, 10, 16, 0, tzinfo=UTC)

SHARED = [f"Shared check {n:02d}" for n in range(1, 15)]
PRIVATE = ["Internal staffing roster", "Catering supplier contracts"]


@dataclass
class GoldenReadiness:
    competition: Any
    event: Any
    readiness: VenueReadiness

    def check(self, title: str) -> ReadinessCheck:
        return self.readiness.checks.get(title=title)


def schedule(
    golden: Golden, *, venue: Any = None, name: str = "Opening Round", organizer: Any = None, **overrides: Any
):
    competition = create_competition(
        organization=organizer or golden.organizations["riverside"], name=f"{name} Cup", sport="football"
    )
    details = {
        "city": "Sacramento",
        "country": "US",
        "region": "north_america",
        "time_zone": "America/Los_Angeles",
        "starts_at": NOW + timedelta(days=6),
        **overrides,
    }
    return competition, schedule_event(
        competition=competition, name=name, venue=venue or golden.organizations["northfield"], **details
    )


def build_golden_readiness(golden: Golden) -> GoldenReadiness:
    competition, event = schedule(golden)
    specs = [CheckSpec(title, critical=title == SHARED[0]) for title in SHARED]
    specs += [CheckSpec(title, shared=False) for title in PRIVATE]
    readiness, _ = open_readiness(event=event, checks=specs)
    result = GoldenReadiness(competition, event, readiness)
    # Evidence on a private check never reaches the organizer's figures.
    submit_evidence(result.check(PRIVATE[0]), title="Roster", at=NOW - timedelta(days=1))
    return result


def accept(check: ReadinessCheck, at: datetime) -> ReadinessCheck:
    submit_evidence(check, title=f"{check.title} evidence", at=at - timedelta(hours=1))
    return review_check(check, accepted=True, at=at)


def other_organizer(golden: Golden) -> Any:
    """A second organizer that runs nothing with Northfield (for scoping tests)."""
    return ensure_organization(name="Elsewhere League", kind="organizer", jurisdiction="GB")
