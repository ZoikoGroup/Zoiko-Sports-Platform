# D-018 — Public IDs are UUID v4; sign-in IDs switched in P2

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U6 |

## Context

Integer IDs in URLs reveal record counts and invite guessing.

## Decision

Every record exposed through the API has a random UUID v4 `public_id`. User IDs switched to UUIDs in P2.

## Consequences

`backend/platform_core/models.py`; `backend/accounts/migrations/0002_user_public_id.py`.
