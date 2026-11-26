# D-029 — Passwords hashed with Argon2id at OWASP cost

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | — |

## Context

Django's Argon2 default uses about 100 MiB per check, which failed under low memory and produced a false "invalid credentials".

## Decision

Argon2id with m=19 MiB, t=2, p=1 (OWASP); older hashes upgrade on the next sign-in.

## Consequences

`backend/accounts/hashers.py`; `backend/config/settings.py` (`PASSWORD_HASHERS`).
