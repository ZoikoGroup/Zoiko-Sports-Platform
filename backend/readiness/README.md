# readiness

**Purpose:** venue readiness for events: the venue's checklist, the evidence it submits, the
organizer's review, and the organizer asking a venue for an update. Feeds the Organizer's
Venues & Readiness page.
**Built in:** P12.1 ([roadmap](../docs/roadmap/P12-remaining-modules.md)), on the defaults of
[D-047](../docs/decisions/D-047-venue-readiness-defaults.md). **Owner:** Developer A.

## Models

| Model | Notes |
|---|---|
| `VenueReadiness` | One venue for one event (unique). Owned, for permissions, by the event's organizer |
| `ReadinessCheck` | `position`, `title`, `state` (open, submitted, accepted, changes_requested), `shared` (visible to the organizer), `critical`, `due_at`, `submitted_at`, `reviewed_at`, `note`. CHECKs: valid state, submitted/reviewed states have their times |
| `ReadinessEvidence` | A record of something submitted for a check (no files yet: P12.8) |
| `UpdateRequest` | `message`, who asked and for which organizer |

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.open_readiness(event, checks)` | write | The venue's checklist (1–100 `CheckSpec`s); returns `(readiness, created)` |
| `services.submit_evidence(check, title)` | write | Check → submitted (409 once accepted) |
| `services.review_check(check, accepted, note)` | write | Submitted → accepted, or changes_requested with a note (409 otherwise) |
| `services.request_update(readiness, message, actor, context)` | write | The organizer asks the venue (message 1–500 characters) |
| `selectors.board(context)` | read | Everything the page shows, from shared checks only (statuses, attention, today's activity, regions) |
| `selectors.visible_readiness(context)` / `readiness_record(context, id)` | read | Scoped through `access`: the organizer's own events, not cancelled |
| `selectors.check_titles(ids)` | read | For event consumers |

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/venue-readiness/{id}/update-requests/` | `{"message": "Upload the renewed certificate."}` → 201 `{"id", "readiness_id", "message", "created_at"}`. Needs `readiness.request_update` and an `Idempotency-Key`; another organizer's readiness answers 404 |

The page's read, `GET /api/v1/organizer/venues/`, is a screen endpoint in `workspaces/organizer/venues.py`.

## Events, permissions, audit

- **Events published:** `readiness.opened` (scope: organizer), `readiness.check_submitted` (scope:
  venue), `readiness.check_reviewed` (scope: venue), `readiness.update_requested` (scope: venue).
  Payloads carry IDs only (never the request message), with `venue_id` and `organizer_id`.
- **Consumed by** `activity.feed`: update requests and reviews become lines in the venue's feed.
- **Permissions** (`policies.py`, migration `0002_permissions`): `readiness.view`,
  `readiness.request_update`, held by competition_director and organizer_coordinator.
- **Audit:** every write (`readiness.opened`, `.check_submitted`, `.check_reviewed`, `.update_requested`).

## Tests

| File | Covers |
|---|---|
| `tests/test_readiness.py` | State rules, database constraints, golden 16/14 sharing, statuses and severities, today's activity across time zones, scoping, the update-request API (idempotency, refusals, feed) |
| `tests/fixtures.py` | The golden event's readiness, used by `workspaces` tests too |

## Known gaps

- Evidence files, storage and malware scanning (P12.8, GI3).
- Venue-side endpoints (submit evidence) arrive with the venue workspace (P12.5); organizer
  review endpoints when the page gets a review action.
- The screen endpoint returns every record at once (pilot volume); add paging if a single
  organizer exceeds a few hundred venue-event pairs.
