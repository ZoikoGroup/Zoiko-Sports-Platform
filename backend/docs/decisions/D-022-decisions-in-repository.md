# D-022 — Decisions live in the repository

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Project lead |
| Phase | Stage 0 |
| Company reference | — |

## Context

With two developers, decisions must be versioned with the code that depends on them and visible without access to an outside document.

## Decision

One file per decision in `backend/docs/decisions/`, checked by `manage.py check_tracker`. The company Claude Doc remains the place for business sign-off and uses the same IDs.

## Consequences

Supersedes D-012. Code comments cite decision IDs.
