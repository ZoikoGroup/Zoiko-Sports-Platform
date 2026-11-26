# D-032 — Self-service invitations wait for the permission engine

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | GP1 |

## Context

Deciding who may invite needs roles and permissions (P3).

## Decision

In P2 only operators create invitations (`manage.py organizations invite`). The self-service API arrives with Team & Access (P12.3).

## Consequences

P2.7 is ⏸ Deferred → P12.3.
