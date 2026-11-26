# D-043 — Django admin is off by default

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P3 |
| Company reference | D12 |

## Context

Django's built-in admin was exposed at /admin/ through nginx. It is Zoiko staff tooling, not the customer-facing Internal Administration product.

## Decision

Mounted only when DJANGO_ADMIN_ENABLED is true (default: on in development, off otherwise), at DJANGO_ADMIN_PATH (outside /api/), for staff accounts only. Sign-ins to it are audited like any other.

## Consequences

`backend/config/settings.py`, `backend/config/urls.py`, `backend/docker-compose.yml`.
