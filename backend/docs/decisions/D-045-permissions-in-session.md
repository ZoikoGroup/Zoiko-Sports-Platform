# D-045 — The session tells the app what the active role may do

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P3 |
| Company reference | — |

## Context

The app should show only actions the server will allow, without guessing from role names.

## Decision

The session payload carries `permissions` (codes granted by the active workspace's role) and each context carries `role_name` from the catalogue. The server still enforces every rule; the list only decides what the app shows.

## Consequences

`backend/accounts/selectors.py`; `frontend/src/auth/roles.ts` (`hasPermission`, `roleLabel`).
