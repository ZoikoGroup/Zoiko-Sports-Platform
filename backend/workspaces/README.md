# workspaces

**Purpose:** screen endpoints: one read per frontend page (`/api/v1/organizer/<page>/`), shaped
for that page and built only from other modules' selectors. Owns no tables and no writes.
**Built in:** P12.1 (first page); later pages in P5–P9 ([architecture](../docs/architecture.md)). **Owner:** the page's owner.

## Models

None.

## Public interface (other modules may use)

None: other modules never depend on screen endpoints.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/organizer/venues/` | Venues & Readiness (`organizer/venues.py`): `{"generated_at", "summary": {"total", "ready", "pending_review", "needs_attention"}, "venues": [...], "attention": [...], "activity": [...], "regions": [...]}`. Needs `readiness.view` |

## Events, permissions, audit

- **Events:** none published or consumed.
- **Permissions:** each endpoint requires the permission of the data it shows (`readiness.view`).
- **Audit:** reads are not audited.

## Tests

| File | Covers |
|---|---|
| `tests/test_module.py` | The venues screen: full shape, attention items, who may read it |

## Known gaps

- Overview, Action Centre, Competitions and Fixtures screens arrive with their phases (P5–P9).
