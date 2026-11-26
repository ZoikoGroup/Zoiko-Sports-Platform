# D-024 — The Individual workspace is kept

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | K1 |

## Context

FSD/RBAC (Nov 5) include an Individual workspace; NAV/AUD (Nov 14) list Organizer, Venue, Club & Team and Internal Admin only.

## Decision

Keep Individual as a workspace (the FSD baseline) until Product decides.

## Consequences

`backend/organizations/selectors.py` (`INDIVIDUAL_CONTEXT`). Removing it later is a small change.
