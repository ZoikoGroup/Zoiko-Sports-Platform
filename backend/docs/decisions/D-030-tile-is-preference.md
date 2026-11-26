# D-030 — The sign-in tile is a preference, never a grant

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-25 |
| Decided by | Project documents (RBAC §03) |
| Phase | P2 |
| Company reference | T02 |

## Context

The earlier code granted access from the tile the user clicked.

## Decision

The server lists eligible contexts; the tile only pre-selects one of them. A tile the account lacks grants nothing.

## Consequences

`backend/accounts/views.py` (`LoginView`); the old `workspace_unavailable` error is retired.
