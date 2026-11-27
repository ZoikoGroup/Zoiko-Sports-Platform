# D-047 — Venue readiness built ahead of P5 on provisional defaults

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-27 |
| Decided by | Project lead (Engineering defaults) |
| Phase | P12 (P12.1), P5 (P5.2 subset) |
| Company reference | GD3, K3, K5, GI3 |

## Context

The Venues & Readiness page had to show live data before P5 (competitions) and P8 (Action
Centre), and before the company answered the decisions P5 and P12.1 wait on. Readiness needs
events, events need competitions, and both need a place for the venue.

## Decision

Build venue readiness now on these defaults, each replaceable when the company decides:

- **Competition and event (GD3, part):** a competition is owned by one organizer organization;
  an event belongs to one competition and is hosted by **one venue organization** (a venue is an
  organization of kind `venue`, not free text). The event carries its city, country (ISO 3166-1),
  region (the workspace's six regions) and IANA time zone. Fixtures are not modelled yet.
- **Lifecycles (K3):** competition `planned / active / completed / cancelled`; event
  `scheduled / completed / cancelled`. No transitions are exposed yet (P5.3).
- **Readiness checks (K5): 4 states:** `open → submitted → accepted`, or `changes_requested`
  back to the venue. A check is `shared` with the organizer or kept private by the venue;
  nothing private is ever read for the organizer. A `critical` check makes its problems high
  severity (others medium).
- **Readiness status** of a venue for an event, from its shared checks: needs attention (a check
  has changes requested, or is open past its due time), ready (every check accepted), otherwise
  pending review. "Today's activity" is today in the event's time zone.
- **Evidence (GI3):** evidence is a record (title, when, by whom). File upload, storage and
  malware scanning wait for the vendor decision (new work package P12.8).
- **Permissions:** `readiness.view` and `readiness.request_update`, granted to
  competition_director and organizer_coordinator. Venue-side permissions come with the venue
  workspace (P12.5).
- **Notification:** an update request reaches the venue through its activity feed until
  notifications exist (P7).

## Consequences

- Code: `backend/competitions/` (P5.2 subset), `backend/readiness/`, `backend/workspaces/organizer/venues.py`,
  `backend/readiness/migrations/0002_permissions.py`, `backend/accounts/management/demo_readiness.py`.
- If GD3 places venues elsewhere (e.g. free text, or a venue per fixture), `competitions.Event.venue`
  and `readiness.VenueReadiness.venue` move with it; the readiness rules do not change.
- If K5 picks 7 states, `readiness.models.CheckState` grows and the mapping to the page's three
  check states (complete, pending, attention) in `readiness/selectors.py` is extended.
- P5 continues from these tables (participation, transitions, endpoints) rather than starting over.
