# D-002 — PostgreSQL 16 is the only database

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-20 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

The first slice used SQLite, which cannot provide the locking the outbox and concurrency rules need. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

PostgreSQL 16 everywhere (development, tests, browser tests, Docker). SQLite removed.

## Consequences

`backend/config/database.py`; tests and browser tests start a throwaway PostgreSQL 16 container.
