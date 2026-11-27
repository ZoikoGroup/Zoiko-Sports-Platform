"""Permission codes of the readiness module (granted by migration 0002_permissions).

- readiness.view: see the readiness of venues hosting your organization's events.
- readiness.request_update: ask such a venue to update its readiness.

Seeded for competition_director and organizer_coordinator (D-047); the venue's own
workspace (P12.5) will add the venue-side permissions.
"""

VIEW = "readiness.view"
REQUEST_UPDATE = "readiness.request_update"
