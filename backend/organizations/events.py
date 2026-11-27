"""Events published by the organizations module (contracts: platform_core.events, D-041).

All IDs are public UUIDs (strings). No emails or names: consumers look them up.
Each event's visibility scope (`organization_id` on the envelope) is the
organization it concerns.
"""

from platform_core.events import EventType

ORGANIZATION_STATUS_CHANGED = EventType(
    "organization.status_changed",
    1,
    fields=("organization_id", "status", "previous_status"),
    description="An organization was verified, suspended or reinstated (pending, active, suspended).",
)

INVITATION_CREATED = EventType(
    "invitation.created",
    1,
    fields=("invitation_id", "organization_id", "role"),
    optional=("invited_by",),
    description="Someone was invited to join an organization with a role.",
)

INVITATION_REVOKED = EventType(
    "invitation.revoked",
    1,
    fields=("invitation_id", "organization_id"),
    description="A pending invitation was withdrawn (also when a newer one replaces it).",
)

INVITATION_ACCEPTED = EventType(
    "invitation.accepted",
    1,
    fields=("invitation_id", "organization_id", "membership_id", "user_id", "role"),
    description="An invitation was accepted: the person is now an active member with that role.",
)

MEMBERSHIP_STATUS_CHANGED = EventType(
    "membership.status_changed",
    1,
    fields=("membership_id", "organization_id", "user_id", "status", "previous_status"),
    description="A membership was suspended, revoked or reactivated (by an operator or a re-invitation).",
)

MEMBERSHIP_GRANTED = EventType(
    "membership.granted",
    1,
    fields=("membership_id", "organization_id", "user_id", "role"),
    description="A person was made an active member directly (operator or demo set-up), not by invitation.",
)
