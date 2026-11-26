# D-037 — Browser tests run in GitHub CI

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Project lead |
| Phase | Stage 0 |
| Company reference | — |

## Context

With two developers merging independently, browser-level regressions must be caught on every pull request, not only on one laptop.

## Decision

An `e2e` job runs the Playwright suite (Microsoft Edge, throwaway PostgreSQL 16) on every push and pull request.

## Consequences

`.github/workflows/ci.yml`; `frontend/e2e/`.
