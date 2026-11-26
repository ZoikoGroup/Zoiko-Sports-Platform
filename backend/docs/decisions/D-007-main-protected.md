# D-007 — `main` accepts only pull requests with green CI

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

Nothing should reach `main` unreviewed or with failing checks. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Protect `main` with a ruleset: pull requests only, required checks, one approving review.

## Consequences

Needs a repository admin (P0.9 is blocked until then). Required checks: `backend`, `frontend`, `e2e`, `tracker` (D-038).
