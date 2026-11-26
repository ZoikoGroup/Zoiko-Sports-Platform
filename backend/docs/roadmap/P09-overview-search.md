# P9 — Overview analytics and search

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P9 | ⬜ Pending | B | P8 | KPI definitions | Overview page, top-bar search |

**Objective:** a fast Overview, and search that never exposes hidden records.

**Layer:** L5. **Track:** platform (B).

**Entry criteria:** P8 merged. D-035 proposes doing P12.1 and P12.2 before P9 (they feed the Overview's alerts).

**Company decisions needed:**
- The KPI definitions, and which set to use (the design and FSD O-00 differ).
- What the activity chart counts by month.
- "Registered Teams" (shown as unknown until a registration module exists, P13).

**Source requirements:** FSD O-00 (four Organizer KPIs), ARCH §12 (PostgreSQL full-text search), ARCH targets: Overview under 300 ms, search under 800 ms (95th percentile).

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P9.1 | Precomputed counters and monthly aggregates, with nightly reconciliation | ⬜ Pending | B | P8, P4 | |
| P9.2 | Overview screen endpoint (each section may be "not available") | ⬜ Pending | B | P9.1 | |
| P9.3 | Global search: PostgreSQL full-text plus trigram, permission-filtered in the query | ⬜ Pending | B | P5, P6, P3.3 | |

### P9.1 Counters and aggregates
- Planned code: new module `backend/analytics/`, updated by the worker from events; a nightly job checks them against the real data.

### P9.2 Overview endpoint
- `GET /api/v1/organizer/overview/`; planned location `backend/workspaces/organizer/overview.py`. Connect `overview` in `endpoints.ts`. The frontend already renders missing sections as "not available".

### P9.3 Search
- Planned code: new module `backend/search/` (GIN indexes on search vectors). Results come only from events the user takes part in.

## Exit criteria

- [ ] Counters always match the reconciliation queries.
- [ ] Overview under 300 ms and search under 800 ms for 95% of requests.
- [ ] Search returns nothing from events the user isn't part of.

## Frontend unlocked

- Overview: the four KPI cards, the activity chart and the participation map.
- Top-bar search.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
