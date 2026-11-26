# D-039 — Seed role catalogue and permissions

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P3 |
| Company reference | GP1, GP2 |

## Context

Roles and permissions must be data before any business endpoint exists, but the company has not signed off the role catalogue (GP1) or delegation rules (GP2).

## Decision

Seed the roles the documents name: competition_director, organizer_coordinator, officials_coordinator (organizer); venue_manager, venue_staff (venue); club_coordinator (club); organization_access_manager (any kind). Leads see organization, members, activity and the audit trail; access managers also manage members and invitations; staff roles see organization and activity. Roles already used by existing members but not in the catalogue are kept as non-assignable legacy roles with no permissions.

## Consequences

`backend/access/migrations/0002_seed_catalogue.py`; `backend/organizations/migrations/0003_roles_from_catalogue.py`. Changing it is a data change (`manage.py access grant|revoke` or a migration), not a code change.
