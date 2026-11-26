# D-016 — Cursor pages of 25, maximum 100

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U4 |

## Context

List endpoints need one shape and limits.

## Decision

Default page size 25, maximum 100 (`API_MAX_PAGE_SIZE`); response `{next, previous, results}`.

## Consequences

`backend/platform_core/pagination.py`.
