<!--
Title: [P3.2] Short description   (one work package per pull request; see backend/docs/handover.md)
Not roadmap work? Use [Fix] …, [CI] … or [Docs] …. The `tracker` check refuses any other title.
Open as a draft as soon as you start: the draft is how the other developer knows the task is taken.
-->

## Work package

- ID and phase file: P?.? — `backend/docs/roadmap/P??-….md`
- What this delivers (one or two sentences):

## Changes

- Modules / files:
- API (`openapi.yaml` changed? yes / no — if yes, what and why):
- Database migrations (new? touch a shared table? upgrade test?):
- Events published or consumed (`events.py`):

## Evidence

- Tests that prove each acceptance item:
- `scripts/ci.sh` result:

## Checklist

- [ ] Every acceptance item of the work package is ticked in its phase file.
- [ ] The tracker row says ✅ Done · PR #<this number>, with `- **Code:**` and `- **Tests:**` paths, plus one progress-log line.
- [ ] The module `README.md` describes what changed.
- [ ] New assumptions have a decision file (`backend/docs/decisions/`).
- [ ] `python manage.py check_tracker --write` was run; CI is green.
- [ ] Writes are tested for denial as well as success; no secrets or personal data in code, logs or docs.
- [ ] Migrations are backward-compatible (add → fill → remove for shared tables).

## Where I stopped

<!-- Only while the work is unfinished: what works, what's half-done, the next step, how to try it. -->
