# D-011 — Upgrade gunicorn 23 → 27 later, not in P0

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-21 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

gunicorn 23.0.0 has no known vulnerabilities; a major upgrade during P0 added risk without benefit. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

The lock keeps gunicorn 23.0.0 for now.

## Consequences

Revisit during P11 (production hardening).
