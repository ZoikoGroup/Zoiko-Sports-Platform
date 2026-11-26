# D-026 — Invitations expire after 7 days

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | — |

## Context

The documents require expiring invitations without a duration.

## Decision

7 days by default, configurable 1–30 (`INVITATION_TTL_DAYS`); the operator command accepts `--expires-days`.

## Consequences

`backend/config/settings.py`; `backend/organizations/services.py`.
