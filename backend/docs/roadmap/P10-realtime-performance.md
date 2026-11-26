# P10 — Live updates and performance

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P10 | ⬜ Pending | B | P9 | Which events update live | Live page updates |

**Objective:** match-day changes reach the right people within seconds, and pages stay fast as data grows.

**Layer:** L5. **Track:** platform (B). Adds infrastructure (Redis, an ASGI server), so it never shares a release with new business logic.

**Entry criteria:** P9 merged.

**Company decision needed:** which events must update live for the pilot (K8 / GA4: the documents disagree on WebSocket versus REST only).

**Source requirements:** ARCH §11 (real-time), ARCH target: visible within 3 seconds for 95% of changes.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P10.1 | Shared cache (Redis) keyed by user, organization and permission version | ⬜ Pending | B | P9 | |
| P10.2 | Conditional requests (ETag / 304) on the screen endpoints | ⬜ Pending | B | P9 | |
| P10.3 | Server push over WebSocket, permission-checked per message; polling stays as fallback | ⬜ Pending | B | P10.1 | |
| P10.4 | Performance pass: query-count limits on every list, index review, pool tuning | ⬜ Pending | B | P9 | |

### P10.1 Cache
- Events clear stale entries ("fixture published" clears that organization's Overview). Nothing is ever shared across organizations.

### P10.2 Conditional requests
- Unchanged screen data is not resent.

### P10.3 Server push
- Planned code: new module `backend/realtime/` (Django Channels). Revoking access closes the connection.
- The frontend needs a small refresh hook in its data layer (`frontend/src/api/`).

### P10.4 Performance pass
- Query-count tests for every list endpoint; results written to the acceptance evidence.

## Exit criteria

- [ ] Changes appear within 3 seconds for 95% of cases.
- [ ] No cache hit or pushed message ever crosses organizations.
- [ ] A revoked user's connection closes within 10 seconds (assumed threshold).

## Frontend unlocked

All four Organizer pages update live.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
