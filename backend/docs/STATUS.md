# Status

Updated 2026-11-26 · Stage 1 (P3 ∥ P4) · `main` = `2e11f4c` (P0, P1, P2 and Stage 0 merged in PR #4)

## In one paragraph

P0–P2 and the Stage 0 tracker are merged. **P3 (permissions and audit) and P4 (event
backbone) are built** on branch `vivekkumar`, waiting for their pull request: a role and
permission catalogue stored as data, one policy engine, an append-only audit trail, a build
check that refuses unprotected endpoints, a permission matrix on the golden event, the outbox
with its worker, the event catalogue and the activity feed (`GET /api/v1/activity/`). Next:
P5 (Competitions), once the company answers GD3 and K3 (or accepts the defaults). **No
Organizer page shows live data yet**: all 11 entries in
`frontend/src/features/organizer/api/endpoints.ts` are `null`, as planned until P5.

## Who is doing what

Each developer edits only their own line. A and B are the two tracks in D-034; names are added
when assigned.

- **Developer A (domain track):** Now: P3 done, pull request to open · Next: P5.1 reference data · Blocked: GD3, K3 (P5)
- **Developer B (platform track):** Now: P4 done, pull request to open · Next: P7 core (if D-035 is approved) or P11 preparation · Blocked: —

## Next gates

1. P3 & P4 pull request merged; `main` protected by a repository admin (P0.9).
2. P5 decisions answered (GD3, K3, venue and teams as organizations, sports list, form fields).

## Waiting on people outside the code

| Item | Who | Blocks |
|---|---|---|
| Protect `main` (required checks `backend`, `frontend`, `e2e`, `tracker`; one review) | Repository admin | P0.9 |
| Confirm the seed role catalogue (D-039) or provide the real one (GP1) | Security / Product | — (defaults in use) |
| Confirm D-033 (workflow), D-034 (two tracks), D-035 (order changes) | Project lead | Stage 2 planning |
| Competition ↔ event ↔ fixture model (GD3), lifecycles (K3), venue and teams as organizations | Architect / Product | P5 |
| Schedule states (K4), approval authority (D08) | Product | P6 |
| Archive the stale remote branch `feature/admin-dashboard` (Nov 3 prototype, unrelated, never merge) | Its owner | — |
