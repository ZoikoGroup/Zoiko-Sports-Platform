"""Events published by the competitions module (contracts: platform_core.events, D-041).

All IDs are public UUIDs (strings). Each event's visibility scope (`organization_id`
on the envelope) is the organizer that owns the competition.
"""

from platform_core.events import EventType

COMPETITION_CREATED = EventType(
    "competition.created",
    1,
    fields=("competition_id", "organization_id", "sport"),
    description="An organizer created a competition.",
)

EVENT_SCHEDULED = EventType(
    "event.scheduled",
    1,
    fields=("event_id", "competition_id", "organization_id", "venue_id", "starts_at"),
    description="An event of a competition was scheduled at a venue (starts_at in UTC).",
)
