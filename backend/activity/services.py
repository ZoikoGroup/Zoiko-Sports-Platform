"""The `activity.feed` consumer: turns outbox events into readable entries (P4.4).

Registered in activity.apps (outbox.services.subscribe). Names are looked up
when the event is processed (payloads carry IDs only); an entry is never
created twice for one event, so duplicated or replayed deliveries are harmless.
"""

from access.selectors import role_names
from accounts.selectors import user_names
from competitions.selectors import event_names
from organizations import events as org_events
from organizations.selectors import organization_names
from outbox.services import DeliveredEvent
from readiness import events as readiness_events
from readiness.selectors import check_titles

from .models import ActivityEntry

CONSUMER = "activity.feed"
SOMEONE = "A member"


def _names(event: DeliveredEvent) -> tuple[str, str, str]:
    """(person, organization, role) display names for the event's payload."""
    payload = event.payload
    person = user_names([payload["user_id"]]).get(payload["user_id"], SOMEONE) if "user_id" in payload else SOMEONE
    organization = organization_names([payload["organization_id"]]).get(payload["organization_id"], "the organization")
    role = role_names([payload["role"]]).get(payload["role"], payload["role"]) if "role" in payload else ""
    return person, organization, role


def _readiness_summary(event: DeliveredEvent) -> str:
    """Readiness events: the organizer acted on the venue's readiness (shown to the venue)."""
    payload = event.payload
    organizer = organization_names([payload["organizer_id"]]).get(payload["organizer_id"], "The organizer")
    if event.type == "readiness.update_requested":
        name = event_names([payload["event_id"]]).get(payload["event_id"])
        return f"{organizer} asked for a readiness update" + (f" for {name}." if name else ".")
    check = check_titles([payload["check_id"]]).get(payload["check_id"], "a readiness check")
    if payload["state"] == "accepted":
        return f"{organizer} accepted {check}."
    return f"{organizer} requested changes to {check}."


def _summary(event: DeliveredEvent) -> str:
    if event.type.startswith("readiness."):
        return _readiness_summary(event)
    person, organization, role = _names(event)
    payload = event.payload
    match event.type:
        case "invitation.created":
            return f"An invitation to join {organization} as {role} was sent."
        case "invitation.revoked":
            return f"An invitation to join {organization} was withdrawn."
        case "invitation.accepted":
            return f"{person} joined {organization} as {role}."
        case "membership.granted":
            return f"{person} was added to {organization} as {role}."
        case "membership.status_changed":
            return {
                "active": f"{person}'s access to {organization} was restored.",
                "suspended": f"{person}'s access to {organization} was suspended.",
                "revoked": f"{person} was removed from {organization}.",
            }.get(payload["status"], f"{person}'s membership of {organization} changed.")
        case "organization.status_changed":
            if payload["status"] == "suspended":
                return f"{organization} was suspended."
            if payload["previous_status"] == "suspended":
                return f"{organization} was reinstated."
            return f"{organization} was verified."
    return f"{event.type} in {organization}."


def handle(event: DeliveredEvent) -> None:
    if event.organization_id is None:
        return
    ActivityEntry.objects.get_or_create(
        event_id=event.id,
        defaults={
            "organization_id": event.organization_id,
            "occurred_at": event.occurred_at,
            "kind": event.type,
            "summary": _summary(event)[:300],
            "target_type": event.aggregate_type,
            "target_id": event.aggregate_id,
        },
    )


SUBSCRIPTIONS = (
    org_events.ORGANIZATION_STATUS_CHANGED,
    org_events.INVITATION_CREATED,
    org_events.INVITATION_REVOKED,
    org_events.INVITATION_ACCEPTED,
    org_events.MEMBERSHIP_GRANTED,
    org_events.MEMBERSHIP_STATUS_CHANGED,
    readiness_events.READINESS_UPDATE_REQUESTED,
    readiness_events.READINESS_CHECK_REVIEWED,
)
