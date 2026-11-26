# Zoiko Sports — project documentation

This folder is the **single source of truth** for what is built, what remains, who is working on
what, and why things were decided. If it is not here (or in the code it points to), it is not
agreed.

## Start here (reading order for a new developer)

1. [STATUS.md](STATUS.md): where the project is today, who is on what, what's next. One page.
2. [ROADMAP.md](ROADMAP.md): all phases P0–P13 on one screen (generated from the phase files).
3. The phase file you are working on, in [roadmap/](roadmap): its work packages, requirements,
   dependencies, acceptance criteria, evidence and progress log.
4. [handover.md](handover.md): how to claim a task, finish it, and hand it over.
5. [architecture.md](architecture.md) and [conventions.md](conventions.md): how the backend is
   organised and the rules every module follows.
6. The `README.md` of the module you will touch, for example
   [organizations/README.md](../organizations/README.md).

## Where each kind of fact lives

Each fact has exactly one home; everything else links to it.

| Fact | Its single home |
|---|---|
| Status of a work package (pending, in progress, done…) | Its phase file in [roadmap/](roadmap) |
| Requirements, dependencies, order, acceptance criteria | The phase file |
| How a finished module works and where its code is | `backend/<module>/README.md` |
| Exact API request and response shapes | [`backend/openapi.yaml`](../openapi.yaml) (generated; CI enforces it) |
| Event contracts between modules | [contracts/events.md](contracts/events.md) (generated; CI enforces it) |
| Which Organizer pages show live data | `frontend/src/features/organizer/api/endpoints.ts` (the on/off switch) |
| Decisions and assumptions | [decisions/](decisions) |
| The shared test scenario | [golden-event.md](golden-event.md) |
| Setup and how to run | The repository [README](../../README.md) |

## Keeping it true

`python manage.py check_tracker` (run by `backend/scripts/ci.sh`) fails the build when:

- a done work package lists no commit, code path or test path, or a path that doesn't exist;
- a phase is marked done while some of its work packages are not;
- a document mentions a decision (D-nnn) that has no file, or two files share a number;
- a relative link points to nothing;
- a backend module has no `README.md`;
- the generated [ROADMAP.md](ROADMAP.md) or [decisions/README.md](decisions/README.md) is stale.

On every pull request, the `tracker` check also refuses code that arrives without its
tracker update, and titles that don't name their work package (D-038).

After editing a phase or decision file, run `python manage.py check_tracker --write` from
`backend/` to refresh the generated files.
