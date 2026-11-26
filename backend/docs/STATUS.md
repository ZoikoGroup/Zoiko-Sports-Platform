# Status

Updated 2026-11-26 · Stage 0 (setup before parallel work) · `main` = `dbb8793` (P0 + P1)

## In one paragraph

P0 (foundation) and P1 (platform kernel) are merged. P2 (identity and organization context) is
built and green in CI on branch `vivekkumar`, waiting for its pull request to `main`. Stage 0
adds this tracker, the decision files and browser tests in CI. Next: P3 (permissions and audit,
track A) and P4 (event backbone, track B) in parallel. **No Organizer page shows live data yet**:
all 11 entries in `frontend/src/features/organizer/api/endpoints.ts` are `null`.

## Who is doing what

Each developer edits only their own line. A and B are the two tracks in D-034; names are added
when assigned.

- **Developer A (domain track):** Now: Stage 0 done, waiting to be pushed with P2 · Next: P3.1 role tables · Blocked: —
- **Developer B (platform track):** Now: — · Next: P4.1 transactional outbox · Blocked: —

## Next gates

1. Stage 0 and P2 merged to `main`; `main` protected by a repository admin (P0.9).
2. P3 ✅ and P4 ✅ → P5 Competitions may start.

## Waiting on people outside the code

| Item | Who | Blocks |
|---|---|---|
| Protect `main` (required checks `backend`, `frontend`, `e2e`, `tracker`; one review) | Repository admin | P0.9 |
| Confirm D-033 (workflow), D-034 (two tracks), D-035 (order changes) | Project lead | Stage 1 planning |
| Role catalogue and permission codes (GP1) | Security / Product | P3 (default: seed roles) |
| Competition ↔ event ↔ fixture model (GD3), lifecycles (K3) | Architect / Product | P5 |
| Schedule states (K4), approval authority (D08) | Product | P6 |
| Archive the stale remote branch `feature/admin-dashboard` (Nov 3 prototype, unrelated, never merge) | Its owner | — |
