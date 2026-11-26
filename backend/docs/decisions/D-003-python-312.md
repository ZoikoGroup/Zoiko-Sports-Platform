# D-003 — Python 3.12 everywhere

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-20 |
| Decided by | Engineering |
| Phase | P0 |
| Company reference | — |

## Context

The local machine ran Python 3.10 (end of life October 2026) while Docker used 3.12. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Python 3.12 for local work, CI and Docker.

## Consequences

`backend/.python-version`, `backend/Dockerfile`, `backend/pyproject.toml`.
