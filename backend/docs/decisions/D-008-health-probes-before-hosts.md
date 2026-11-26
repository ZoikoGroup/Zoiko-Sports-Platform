# D-008 — Health probes work under any production host list

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

Container health checks call the API by an internal address that is not in `ALLOWED_HOSTS`. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Liveness and readiness probes answer before host validation; everything else stays host-checked.

## Consequences

`backend/platform_core/middleware.py`; tested in `test_foundation.py`.
