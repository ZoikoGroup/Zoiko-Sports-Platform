# D-027 — An invitation can be accepted only by the invited email address

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | — |

## Context

The documents list this as an unresolved edge case.

## Decision

Accepting with an account whose email differs is refused (`403 invitation_email_mismatch`).

## Consequences

`backend/organizations/services.py` (`accept_invitation`).
