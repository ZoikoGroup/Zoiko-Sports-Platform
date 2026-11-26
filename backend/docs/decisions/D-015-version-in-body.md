# D-015 — Edits send the expected version in the body; ETags later

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-24 |
| Decided by | Engineering |
| Phase | P1 |
| Company reference | U3 |

## Context

The frontend already sends a version in the body; the documents ask for `ETag`/`If-Match`.

## Decision

Version in the request body now. `ETag`/`If-Match` arrive with the first editable resource (P5/P6) and conditional reads in P10.

## Consequences

`backend/platform_core/concurrency.py`; tracked in P5.4 and P10.2.
