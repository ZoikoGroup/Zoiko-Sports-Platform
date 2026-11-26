# D-014 — Idempotency: required on creates, 24 hours, `Idempotency-Key`

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U2 |

## Context

The documents require idempotent creates (HO §05) but give no header, scope or retention.

## Decision

Creates require an `Idempotency-Key` header; keys belong to one user and expire after 24 hours (`IDEMPOTENCY_TTL_HOURS`). Same key with a different body → 422.

## Consequences

`backend/platform_core/idempotency.py`.
