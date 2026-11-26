# D-019 — API contract in `backend/openapi.yaml`; schema page in development only

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U7 |

## Context

The API contract must be reviewable in pull requests.

## Decision

The generated contract is committed at `backend/openapi.yaml` and CI fails when the code differs. `/api/v1/schema/` is served only with debug on.

## Consequences

`backend/scripts/ci.sh`; `backend/config/urls.py`.
