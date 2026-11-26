# D-028 — Re-inviting a removed member restores them with the new role

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | — |

## Context

A removed or suspended member may be invited again.

## Decision

Accepting reactivates the existing membership with the role from the new invitation.

## Consequences

`backend/organizations/services.py` (`accept_invitation`).
