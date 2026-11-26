# D-005 — Django REST Framework 3.18.3 minimum

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-20 |
| Decided by | Engineering |
| Phase | P0 |
| Company reference | — |

## Context

DRF 3.16.1 had five published security advisories. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

DRF 3.18.3 or later.

## Consequences

`backend/requirements.in`; `pip-audit` in CI catches future advisories.
