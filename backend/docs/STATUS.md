# Status

Updated 2026-11-27 · `main` = `3ddf2b7` (PR #7 merged: P12.1 venue readiness) · next: P12.9–P12.11 or P5

## In one paragraph

P0–P4, the database integrity rules (D-046) and **venue readiness (P12.1, PR #7)** are merged.
P12.1 was built ahead of the roadmap order on the provisional defaults of D-047: a first
`competitions` subset (competitions and events, venues as organizations), the `readiness`
module (checklists with shared and private checks, evidence records, reviews, update requests)
and the first screen endpoint, `GET /api/v1/organizer/venues/`. **The Venues & Readiness page is
the first Organizer page on live data**: 2 of the 13 entries in
`frontend/src/features/organizer/api/endpoints.ts` are connected (`venues`,
`requestReadinessUpdate`); the other 11 stay `null` until their phases. The page is complete for
**viewing** readiness and **asking** a venue for an update; reviewing checks, the venue's own
side and checklist set-up are not built yet: **P12.9–P12.14** in
[roadmap/P12](roadmap/P12-remaining-modules.md) list them with dependencies and acceptance
criteria, and its P12.1 section gives the page's status element by element. Next for the domain
track: P12.9–P12.11 (no company decision needed except the past-event window), or P5
(Competitions) once the company answers GD3 and K3.

## Who is doing what

Each developer edits only their own line. A and B are the two tracks in D-034; names are added
when assigned.

- **Developer A (domain track):** Now: P12.1 done (PR #7) · Next: P12.9, P12.10, P12.11 (venue readiness completion), then P5.1 · Blocked: GD3, K3 (P5); checklist templates (P12.12)
- **Developer B (platform track):** Now: P4 done · Next: P7 core (if D-035 is approved) or P11 preparation · Blocked: —

## Next gates

1. `main` protected by a repository admin (P0.9).
2. D-047 confirmed or replaced (competition/event model, 4 check states, venue as organization).
3. The past-event window for the readiness queue decided (unblocks P12.9).
4. P5 decisions answered (GD3, K3, sports list, form fields); the checklist template decision (P12.12).

## Waiting on people outside the code

| Item | Who | Blocks |
|---|---|---|
| Protect `main` (required checks `backend`, `frontend`, `e2e`, `tracker`; one review) | Repository admin | P0.9 |
| Confirm the seed role catalogue (D-039) or provide the real one (GP1) | Security / Product | — (defaults in use) |
| Confirm D-033 (workflow), D-034 (two tracks), D-035 (order changes) | Project lead | Stage 2 planning |
| Confirm D-047 (venue readiness defaults: venue as organization, K5 4 states) | Product / Architect | — (defaults in use) |
| How long a finished event stays in the readiness queue (proposal: 24 hours after start) | Product | P12.9 |
| Who defines a venue's readiness checklist (organizer template, venue, both), the standard items, who decides sharing | Product | P12.12 |
| Competition ↔ event ↔ fixture model (GD3), lifecycles (K3) | Architect / Product | P5 (and so P12.12) |
| Evidence storage and malware-scanning vendor (GI3), file limits | Security / Product | P12.8 |
| Schedule states (K4), approval authority (D08) | Product | P6 |
| Archive the stale remote branch `feature/admin-dashboard` (Nov 3 prototype, unrelated, never merge) | Its owner | — |
