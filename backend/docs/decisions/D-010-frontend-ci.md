# D-010 — Frontend checks join CI

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

Frontend changes need the same gate as the backend. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Lint, type check, build, `npm audit` and image scan run in CI.

## Consequences

`frontend/scripts/ci.sh` and the `frontend` job in `.github/workflows/ci.yml`.
