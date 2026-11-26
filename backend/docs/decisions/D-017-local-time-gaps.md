# D-017 — Non-existent and repeated local times are rejected

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U5 |

## Context

Daylight-saving changes create local times that don't exist or happen twice. This is a product decision needed before P6.

## Decision

Reject both and ask the user to choose, unless the caller states which side it means.

## Consequences

`backend/platform_core/timeutils.py`. Confirm with Product before P6.
