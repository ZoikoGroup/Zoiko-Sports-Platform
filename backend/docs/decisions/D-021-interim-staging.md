# D-021 — The Docker stack is the interim staging environment

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U9 |

## Context

No hosting is chosen yet (GI5), but each phase needs a gate on a real stack.

## Decision

Each phase is checked on the full Docker stack (nginx, API, PostgreSQL) until a staging environment exists.

## Consequences

Replaced by real staging in P11.5.
