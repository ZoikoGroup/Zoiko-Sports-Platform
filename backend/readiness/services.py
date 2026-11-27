"""Write operations of the readiness module (the public write interface).

- open_readiness: the venue's checklist for an event (one per event and venue).
- submit_evidence / review_check: a check moves open → submitted → accepted, or
  back to the venue with changes requested (K5 default, D-047).
- request_update: the event's organizer asks the venue to update its readiness.

Each operation runs in one transaction with its audit entry (P3) and its event
(P4). Callers check permissions first (the API uses access.selectors.can); these
functions enforce the state rules. `at` lets imports and demo data record when
something happened; it defaults to now.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from audit.services import record
from outbox.services import publish
from platform_core.errors import ApiError
from platform_core.timeutils import to_utc
from platform_core.workspace import WorkspaceContext

from . import events
from .models import ReadinessCheck, ReadinessEvidence, UpdateRequest, VenueReadiness

MAX_CHECKS = 100
MESSAGE_LIMIT = 500
NOTE_LIMIT = 300


@dataclass(frozen=True)
class CheckSpec:
    """One checklist item when a venue's readiness is set up."""

    title: str
    shared: bool = True
    critical: bool = False
    due_at: datetime | None = None


def _invalid(field: str, message: str) -> ApiError:
    return ApiError("validation_error", message, fields={field: [message]})


def _conflict(code: str, message: str) -> ApiError:
    return ApiError(code, message, status.HTTP_409_CONFLICT)


def _sides(readiness: VenueReadiness) -> dict[str, str]:
    return {
        "venue_id": str(readiness.venue.public_id),
        "organizer_id": str(readiness.event.competition.organization.public_id),
    }


def _when(at: datetime | None) -> datetime:
    return timezone.now() if at is None else to_utc(at)


def _title(value: str, field: str = "title") -> str:
    title = (value or "").strip()
    if not title or len(title) > 200:
        raise _invalid(field, "Enter a title of up to 200 characters.")
    return title


# --- Checklist --------------------------------------------------------------------


def open_readiness(*, event: Any, checks: Sequence[CheckSpec], actor: Any = None) -> tuple[VenueReadiness, bool]:
    """The event venue's readiness with this checklist; (existing, False) if it is already set up."""
    if not 1 <= len(checks) <= MAX_CHECKS:
        raise _invalid("checks", f"Give between 1 and {MAX_CHECKS} checks.")
    rows = []
    for position, spec in enumerate(checks, start=1):
        due_at = None if spec.due_at is None else _when(spec.due_at)
        rows.append(
            ReadinessCheck(
                position=position,
                title=_title(spec.title, "checks"),
                shared=spec.shared,
                critical=spec.critical,
                due_at=due_at,
            )
        )
    with transaction.atomic():
        existing = VenueReadiness.objects.filter(event=event, venue=event.venue).first()
        if existing is not None:
            return existing, False
        readiness = VenueReadiness.objects.create(event=event, venue=event.venue)
        for row in rows:
            row.readiness = readiness
        ReadinessCheck.objects.bulk_create(rows)
        shared = sum(1 for row in rows if row.shared)
        record(
            "readiness.opened",
            actor=actor,
            target=("readiness", readiness.public_id),
            details={"event": str(event.public_id), "checks": len(rows), "shared_checks": shared},
        )
        sides = _sides(readiness)
        publish(
            events.READINESS_OPENED,
            {
                "readiness_id": str(readiness.public_id),
                "event_id": str(event.public_id),
                **sides,
                "checks": len(rows),
                "shared_checks": shared,
            },
            aggregate=("readiness", readiness.public_id),
            organization_id=event.competition.organization.public_id,
        )
    return readiness, True


def _locked(check: ReadinessCheck) -> ReadinessCheck:
    return (
        ReadinessCheck.objects.select_for_update()
        .select_related("readiness__venue", "readiness__event__competition__organization")
        .get(pk=check.pk)
    )


def submit_evidence(
    check: ReadinessCheck, *, title: str, actor: Any = None, at: datetime | None = None
) -> ReadinessEvidence:
    """The venue adds evidence; the check goes to submitted (again, after changes were requested)."""
    title = _title(title)
    when = _when(at)
    with transaction.atomic():
        check = _locked(check)
        if check.state == ReadinessCheck.State.ACCEPTED:
            raise _conflict("check_already_accepted", "This check is already accepted.")
        evidence = ReadinessEvidence.objects.create(
            check_item=check, title=title, submitted_by=actor if getattr(actor, "is_authenticated", False) else None
        )
        check.state = ReadinessCheck.State.SUBMITTED
        check.submitted_at = when
        check.reviewed_at = None
        check.note = ""
        check.save(update_fields=["state", "submitted_at", "reviewed_at", "note", "updated_at"])
        record(
            "readiness.check_submitted",
            actor=actor,
            target=("readiness_check", check.public_id),
            details={"evidence": str(evidence.public_id)},
        )
        publish(
            events.READINESS_CHECK_SUBMITTED,
            {
                "check_id": str(check.public_id),
                "readiness_id": str(check.readiness.public_id),
                **_sides(check.readiness),
                "shared": check.shared,
            },
            aggregate=("readiness", check.readiness.public_id),
            organization_id=check.readiness.venue.public_id,
        )
    return evidence


def review_check(
    check: ReadinessCheck, *, accepted: bool, note: str = "", actor: Any = None, at: datetime | None = None
) -> ReadinessCheck:
    """The organizer accepts submitted evidence, or sends the check back with a reason."""
    note = (note or "").strip()
    if not accepted and not note:
        raise _invalid("note", "Say what the venue should change.")
    if len(note) > NOTE_LIMIT:
        raise _invalid("note", f"Keep the note to {NOTE_LIMIT} characters.")
    when = _when(at)
    with transaction.atomic():
        check = _locked(check)
        if check.state != ReadinessCheck.State.SUBMITTED:
            raise _conflict("check_not_submitted", "Only submitted evidence can be reviewed.")
        check.state = ReadinessCheck.State.ACCEPTED if accepted else ReadinessCheck.State.CHANGES_REQUESTED
        check.reviewed_at = when
        check.note = "" if accepted else note
        check.save(update_fields=["state", "reviewed_at", "note", "updated_at"])
        record(
            "readiness.check_reviewed",
            actor=actor,
            target=("readiness_check", check.public_id),
            details={"state": check.state},
        )
        publish(
            events.READINESS_CHECK_REVIEWED,
            {
                "check_id": str(check.public_id),
                "readiness_id": str(check.readiness.public_id),
                **_sides(check.readiness),
                "state": check.state,
            },
            aggregate=("readiness", check.readiness.public_id),
            organization_id=check.readiness.venue.public_id,
        )
    return check


# --- Update requests ---------------------------------------------------------------


def request_update(readiness: VenueReadiness, *, message: str, actor: Any, context: WorkspaceContext) -> UpdateRequest:
    """The organizer (acting in `context`) asks the venue to update its readiness."""
    message = (message or "").strip()
    if not message:
        raise _invalid("message", "Say what the venue should update.")
    if len(message) > MESSAGE_LIMIT:
        raise _invalid("message", f"Keep the message to {MESSAGE_LIMIT} characters.")
    if context.organization_id is None:
        raise ValueError("request_update needs an organization workspace context.")
    with transaction.atomic():
        update = UpdateRequest.objects.create(
            readiness=readiness,
            message=message,
            requested_by=actor if getattr(actor, "is_authenticated", False) else None,
            requested_by_organization_id=context.organization_id,
        )
        # The message is free text: it stays in this module (never in audit details or events).
        record(
            "readiness.update_requested",
            actor=actor,
            target=("readiness", readiness.public_id),
            details={"request": str(update.public_id)},
        )
        publish(
            events.READINESS_UPDATE_REQUESTED,
            {
                "request_id": str(update.public_id),
                "readiness_id": str(readiness.public_id),
                "event_id": str(readiness.event.public_id),
                **_sides(readiness),
            },
            aggregate=("readiness", readiness.public_id),
            organization_id=readiness.venue.public_id,
        )
    return update
