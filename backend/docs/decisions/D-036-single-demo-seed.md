# D-036 — The demo seed stays one command for now

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | Stage 0 |
| Company reference | — |

## Context

Stage 0 planned one seed per module. Only `organizations` seeds data today, and a per-module seed would need dynamic imports that bypass the module boundary check.

## Decision

Keep `accounts/management/commands/seed_demo.py`, which writes only through `organizations.services`. Revisit when a second module (P5) needs demo data.

## Consequences

Golden-event data is described in `backend/docs/golden-event.md`.
