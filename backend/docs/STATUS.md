# Status

Updated 2026-11-27 · Stage 1 (P3 ∥ P4) merged · `main` = `3053f74` (PR #5, PR #6 merged) · P12.1 done in PR #7

## In one paragraph

P0–P4, the database integrity rules (D-046) and the backend image fix (PR #6) are merged. **Venue
readiness (P12.1) is done in PR #7** (✅ on `main` once it merges), ahead of the roadmap order on the provisional defaults of D-047: a first
`competitions` subset (competitions and events, venues as organizations), the `readiness`
module (checklists with shared and private checks, evidence records, reviews, update requests)
and the first screen endpoint, `GET /api/v1/organizer/venues/`. **The Venues & Readiness page is
the first Organizer page on live data**: 2 of the 13 entries in
`frontend/src/features/organizer/api/endpoints.ts` are connected (`venues`,
`requestReadinessUpdate`); the other 11 stay `null` until their phases. Next: P5
(Competitions), once the company answers GD3 and K3 (or accepts the D-047 defaults).

## Who is doing what

Each developer edits only their own line. A and B are the two tracks in D-034; names are added
when assigned.

- **Developer A (domain track):** Now: P12.1 in PR #7 (review) · Next: P5.1 reference data, then the rest of P5.2 · Blocked: GD3, K3 (P5)
- **Developer B (platform track):** Now: P4 done · Next: P7 core (if D-035 is approved) or P11 preparation · Blocked: —

## Next gates

1. PR #7 (P12.1) reviewed and merged; `main` protected by a repository admin (P0.9).
2. D-047 confirmed or replaced (competition/event model, 4 check states, venue as organization).
3. P5 decisions answered (GD3, K3, sports list, form fields).

## Waiting on people outside the code

| Item | Who | Blocks |
|---|---|---|
| Protect `main` (required checks `backend`, `frontend`, `e2e`, `tracker`; one review) | Repository admin | P0.9 |
| Confirm the seed role catalogue (D-039) or provide the real one (GP1) | Security / Product | — (defaults in use) |
| Confirm D-033 (workflow), D-034 (two tracks), D-035 (order changes) | Project lead | Stage 2 planning |
| Confirm D-047 (venue readiness defaults: venue as organization, K5 4 states) | Product / Architect | — (defaults in use) |
| Competition ↔ event ↔ fixture model (GD3), lifecycles (K3) | Architect / Product | P5 |
| Evidence storage and malware-scanning vendor (GI3), file limits | Security / Product | P12.8 |
| Schedule states (K4), approval authority (D08) | Product | P6 |
| Archive the stale remote branch `feature/admin-dashboard` (Nov 3 prototype, unrelated, never merge) | Its owner | — |
