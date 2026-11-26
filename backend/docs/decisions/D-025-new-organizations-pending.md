# D-025 — New organizations start pending; an operator verifies them

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | D11 / GP4 |

## Context

Who verifies a new organization is undecided (FSD D11).

## Decision

New organizations are `pending` and grant no access until verified. Operators verify with `manage.py organizations verify` until Internal Administration exists (P12.6).

## Consequences

`backend/organizations/services.py`.
