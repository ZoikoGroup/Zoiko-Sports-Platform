"""Events published by the readiness module (contracts: platform_core.events, D-041).

All IDs are public UUIDs (strings); no free text (an update request's message stays
in the readiness module). Every payload names both sides: `organizer_id` (the
event's organizer) and `venue_id`. The envelope's `organization_id` (visibility
scope) is the side the event is meant for, given in each description.
"""

from platform_core.events import EventType

READINESS_OPENED = EventType(
    "readiness.opened",
    1,
    fields=("readiness_id", "event_id", "venue_id", "organizer_id", "checks", "shared_checks"),
    description="A venue's readiness checklist for an event was set up (scope: the organizer).",
)

READINESS_CHECK_SUBMITTED = EventType(
    "readiness.check_submitted",
    1,
    fields=("check_id", "readiness_id", "venue_id", "organizer_id", "shared"),
    description="The venue submitted evidence for a check (scope: the venue; the organizer sees shared checks on its page).",
)

READINESS_CHECK_REVIEWED = EventType(
    "readiness.check_reviewed",
    1,
    fields=("check_id", "readiness_id", "venue_id", "organizer_id", "state"),
    description="The organizer accepted a check or requested changes; state is accepted or changes_requested (scope: the venue).",
)

READINESS_UPDATE_REQUESTED = EventType(
    "readiness.update_requested",
    1,
    fields=("request_id", "readiness_id", "event_id", "venue_id", "organizer_id"),
    description="An organizer asked a venue to update its readiness (scope: the venue).",
)
