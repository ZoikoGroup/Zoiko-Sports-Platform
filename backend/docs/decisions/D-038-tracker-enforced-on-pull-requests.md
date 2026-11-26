# D-038 — The tracker is enforced on every pull request

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Project lead |
| Phase | Stage 0 |
| Company reference | — |

## Context

The tracker in `backend/docs` was validated by CI, but nothing stopped code from reaching
`main` without its tracker update: a forgotten status change went unnoticed and the tracker
stopped telling the truth.

## Decision

On every pull request to `main`, the `tracker` check (`.github/workflows/tracker.yml`) requires:

- a title that names its work: work packages (`[P3.2] Policy engine`), whole phases (`[P2]`),
  or `[Fix]`, `[CI]`, `[Docs]` for changes that are not roadmap work;
- every named work package or phase exists in the tracker;
- if the pull request changes code, the named item's phase file changes in the same pull
  request and the item says 👀 In review or ✅ Done;
- a `[Docs]`-only pull request changes no code;
- the tracker as a whole is consistent (`check_tracker`).

A work package is marked ✅ **inside its own pull request**, referencing the pull request
number (`PR #12`): the row reaches `main` only when the pull request merges, so there is no
step after merging. No bot writes to the repository.

## Consequences

- `python manage.py check_pull_request` (rules in `backend/platform_core/tracker.py`) runs on
  GitHub and locally; `backend/docs/handover.md` shows how.
- `ROADMAP.md` gains the overall progress and a "Recently completed" list from the progress logs.
- An optional git hook (`backend/scripts/git-hooks/pre-commit`) refreshes the generated files.
- `tracker` joins `backend`, `frontend` and `e2e` as a required check on `main` (D-007).
- Updating the row stays a human step: only the developer knows when the acceptance criteria are met.
