# D-023 — The implementation tracker lives in `backend/docs/`

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | Stage 0 |
| Company reference | — |

## Context

The repository root may hold only `frontend/`, `backend/`, `README.md` and `.github/`. The tracker follows the backend roadmap; connecting a page is part of its backend phase.

## Decision

Tracker, roadmap, decisions and handover notes live in `backend/docs/`. A root `docs/` folder would need an exception like D-006.

## Consequences

Moving it later only changes paths; `check_tracker --docs` accepts another folder.
