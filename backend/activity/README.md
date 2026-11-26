# activity

**Purpose:** the activity feed: short, readable lines built from events ("Casey Club joined
Club A as Club coordinator."), visible only to the organization they concern.
**Built in:** P4 ([roadmap](../docs/roadmap/P04-event-backbone.md)). **Owner:** Developer B.

## Models

| Model | Notes |
|---|---|
| `ActivityEntry` | `event_id` (unique: a replayed event never makes a second entry), `organization_id` (visibility scope, public UUID), `occurred_at`, `kind` (event type), `summary`, `target_type` / `target_id` |

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `selectors.feed_for(context)` | read | Entries the context may see, newest first (scoped through `access`) |
| `selectors.latest_for(context, limit=3)` | read | For the "Recent Updates" sections of screen endpoints (from P5) |

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/activity/` | The acting organization's feed, cursor-paginated. Needs a workspace whose role grants `activity.view` (403 otherwise; 403 `context_required` without a workspace) |

Example entry: `{"id": "…", "occurred_at": "2026-11-26T10:15:00Z", "kind": "invitation.accepted",
"summary": "Casey Club joined Club A as Club coordinator."}`

## Events

- **Consumes** (consumer `activity.feed`): `organization.status_changed`, `invitation.created`,
  `invitation.revoked`, `invitation.accepted`, `membership.granted`, `membership.status_changed`.
- Names are looked up when the event is processed; payloads carry IDs only.

## Tests

`tests/test_activity.py`: every event becomes a readable line, replays never duplicate, unknown
people, unscoped events, the endpoint (pages, refusals) and invitation → worker → feed end to end.

## Known gaps

- From P5, entries about an event will also be visible to the organizations taking part in it.
- The frontend's "Recent Updates" cards connect through the screen endpoints (P5, P9).
