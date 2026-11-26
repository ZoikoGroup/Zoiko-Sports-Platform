# D-006 — CI runs on GitHub Actions; `.github/` allowed at the repository root

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

The repository root may hold only `frontend/`, `backend/` and `README.md`; GitHub reads workflows only from `.github/`. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

GitHub Actions runs the CI. `.github/` is the one exception to the root-folder rule.

## Consequences

`.github/workflows/ci.yml` runs `backend/scripts/ci.sh` and `frontend/scripts/ci.sh`.
