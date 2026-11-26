# D-009 — Debug mode is off unless `DJANGO_DEBUG=true`

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

A forgotten setting must never expose debug pages in production. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Debug defaults to off; `backend/.env.example` turns it on for local work.

## Consequences

`backend/config/settings.py`.
