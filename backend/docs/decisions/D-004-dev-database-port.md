# D-004 — Development database on 127.0.0.1:5433

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-20 |
| Decided by | Engineering |
| Phase | P0 |
| Company reference | — |

## Context

A locally installed PostgreSQL already uses port 5432. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

The development database listens on 127.0.0.1:5433.

## Consequences

`backend/docker-compose.dev.yml`; `backend/.env.example`.
