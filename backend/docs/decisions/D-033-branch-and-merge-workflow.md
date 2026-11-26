# D-033 — One short branch and one pull request per work package; squash merges

| Field | Value |
|---|---|
| Status | 📝 Proposed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | Stage 0 |
| Company reference | — |

## Context

Two developers work in parallel; long-lived personal branches cause large, late merges.

## Decision

Branches `<dev>/<work-package>-<slug>` off `main`; one pull request per work package, opened as a draft on day one; squash-merge with the ID in the title.

## Consequences

Described in `backend/docs/handover.md`. Needs the project lead's confirmation.
