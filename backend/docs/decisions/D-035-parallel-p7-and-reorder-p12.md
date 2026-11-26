# D-035 — Build P7's core during P6; move P12.1 and P12.2 before P9

| Field | Value |
|---|---|
| Status | 📝 Proposed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | Stage 0 |
| Company reference | — |

## Context

Notifications depend on P6's event format, not its tables. The pilot's golden event needs venue readiness and exceptions.

## Decision

P7.1–P7.4 are built against the event formats P6 publishes first and connected when P6 merges. P12.1 and P12.2 follow P8, before P9.

## Consequences

Changes two entry criteria of the approved roadmap; needs the project lead's approval.
