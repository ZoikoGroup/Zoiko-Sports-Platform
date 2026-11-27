# P8 — Work items: the Action Centre engine

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P8 | ⬜ Pending | B | P5, P6, P7 | GB4 and 3 more | Action Centre page, sidebar badge |

**Objective:** one definition of "what needs my attention", shared by every page.

**Layer:** L5. **Track:** platform (B). The engine (P8.1, P8.3) is generic and can start while P6/P7 finish; each source plugs in as it lands.

**Entry criteria:** P5, P6 and P7 merged (for the approval and acknowledgment sources).

**Company decisions needed:**
- Priority rules (high / medium / low).
- Where deadlines come from (approval due, check due, …).
- What counts as an alert, and the severity scale (GB4).
- Whether the design's sponsorship, media and registration item types stay (they are outside Phase 1).

**Source requirements:** FSD O-01 and §13 ("totals must equal the lists").

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P8.1 | Work-item store: kind, title, context, assignee, due time, priority, status, target, source | ⬜ Pending | B | P4 | |
| P8.2 | Plug-in sources listening to events: approvals, invitations, acknowledgments | ⬜ Pending | B | P8.1, P6, P7 | |
| P8.3 | Summary totals computed with the same filter as the lists | ⬜ Pending | B | P8.1 | |
| P8.4 | Screen data: Action Centre endpoint; Overview, Needs Attention and badge sections | ⬜ Pending | B | P8.2, P8.3 | |

### P8.1 Work-item store
- Planned code: new module `backend/workitems/`. Indexes on (assignee, status, due) and (organization, kind).

### P8.2 Sources
- Each source is a small consumer of another module's events; venue readiness and exceptions (P12.1, P12.2) add theirs later without changing the engine.
- Venue readiness has no "became overdue" event yet: P12.14 adds `readiness.check_overdue` at the start of P8, so overdue checks can become Action Centre items.

### P8.3 Totals equal lists
- Every summary figure comes from the same query as its list.

### P8.4 Screen data
- `GET /api/v1/organizer/action-center/`; planned location `backend/workspaces/organizer/action_center.py`. Connect `actionCenter` in `endpoints.ts`.

## Exit criteria

- [ ] Every total equals the length of its full list.
- [ ] Replaying events opens and closes items correctly.
- [ ] Adding a new source requires no change to Action Centre code (proved by a test).

## Frontend unlocked

- The Action Centre page.
- Overview: Tasks & Approvals and Operational Alerts.
- Competitions: Needs Attention and the Awaiting Review figure.
- The sidebar badge.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
