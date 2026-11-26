# D-020 — Request IDs come from nginx, with Django as fallback

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U8 |

## Context

One correlation ID must follow a request through nginx, Django, logs and errors.

## Decision

nginx's `$request_id` in `X-Request-ID`; Django generates one when it is missing.

## Consequences

`backend/platform_core/request_context.py`; `frontend/nginx.conf`.
