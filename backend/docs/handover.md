# Handover: how to pick up, do and finish work

Everything a developer needs to continue without asking anyone. The workflow below is
proposed in D-033 and D-034 and applies once the project lead confirms them.

## 1. Get running (once)

Follow the repository [README](../../README.md) (§5 Docker, §6 development). Then prove the
backend works before changing anything:

```bash
cd backend
CI_SKIP_IMAGE=1 bash scripts/ci.sh     # lint, types, checks, tracker, migrations, API contract, tests
```

## 2. Find your task

1. [STATUS.md](STATUS.md): which stage the project is in and what each developer is on.
2. The phase file in [roadmap/](roadmap): pick the first ⬜ work package of your track whose
   "Depends on" items are all ✅.
3. Check nobody has it: no 🔄 in its row, and no open pull request with its ID in the title.
4. Read its requirements, decisions and acceptance criteria. If a needed company decision is
   missing, use the documented default and record it as a decision file (🟡 Assumed). If there is
   no safe default, mark the row ⛔ with the decision ID and take the next task.

## 3. Claim it

```bash
git switch main && git pull
git switch -c b/p4.1-outbox                      # <dev>/<work-package>-<slug>
```

- Open a **draft pull request** titled `[P4.1] Transactional outbox` straight away. The title
  must name the work package: the `tracker` check refuses any other title (D-038). Changes that
  are not roadmap work use `[Fix] …`, `[CI] …` or `[Docs] …`.
- Optionally set the row to `🔄 In progress` and your line in [STATUS.md](STATUS.md).

The draft pull request is what tells the other developer the task is taken.

Once per clone, you can let git refresh the generated tracker files on every commit:

```bash
git config core.hooksPath backend/scripts/git-hooks    # from the repository root
```

## 4. Do it

- New module: `python manage.py startapp <name> --template=platform_core/app_template`, then
  add it to `INSTALLED_APPS` and fill in its `README.md`.
- Tests first, from the acceptance criteria. Test docstrings cite the work-package ID and any
  document test ID (for example `"""P3.2 / FSD T17: a removed member is denied."""`), so
  `git grep P3.2` finds everything about a task.
- Commit messages start with the ID: `P4.1: write events in the change's transaction`.
- Follow [conventions.md](conventions.md); the boundary rule is checked automatically.
- Rebase on `main` at least daily. After a rebase, regenerate `openapi.yaml` (never hand-merge it).

## 5. Stopping part-way (end of day, leave, reassignment)

Push the branch. Add a **"Where I stopped"** section to the pull request description:

```
## Where I stopped (2026-11-28)
- Works: outbox table, write helper, 6 tests green.
- Half-done: relay loop (outbox/relay.py) — no retry yet.
- Next step: backoff + dead-letter state (P4.2 acceptance item 2).
- To try it: python manage.py test outbox
```

Work that exists only on one laptop does not exist.

## 6. Finish it

Before asking for review, **in the same pull request** (D-038):

- [ ] Every acceptance item of the work package is ticked, with the tests that prove it.
- [ ] The row says `✅ Done` with the pull request number (`PR #12`); the detail section lists
      `- **Code:**` and `- **Tests:**` paths (backticked, relative to the repository root).
- [ ] One line in the phase file's progress log: `- 2026-11-28 · P4.1 · PR #12 · what changed.`
      It appears in `ROADMAP.md` under "Recently completed".
- [ ] The module `README.md` describes what was added.
- [ ] Any new assumption has a decision file.
- [ ] `python manage.py check_tracker --write` was run (the git hook does it for you), and
      `scripts/ci.sh` is green.

Check the pull request the way GitHub will, before pushing (from `backend/`):

```bash
git diff --name-only main...HEAD | python manage.py check_pull_request --title "[P4.1] Transactional outbox"
```

The ✅ reaches `main` only when the pull request merges, so **there is nothing to do after the
merge**. The other developer reviews code, tests **and** docs together and blocks the pull
request if they disagree. Update your line in [STATUS.md](STATUS.md) when you take the next task.

## What GitHub checks on every pull request

| Check | Refuses the pull request when… |
|---|---|
| `tracker` | the title names no work package (or `[Fix]`/`[CI]`/`[Docs]`); a named ID is not in the tracker; code changed but the work package's phase file did not, or its row is not 👀/✅; a `[Docs]` pull request changes code; the tracker is inconsistent |
| `backend` | lint, types, checks, tracker, migrations, API contract, tests, coverage, audits or image scan fail |
| `frontend` | lint, type check, build, `npm audit` or image scan fail |
| `e2e` | any browser test fails |

A feature that has no row yet gets one first (the next free ID in its phase, for example
`P3.10`); then its pull request can name it.

## 7. Finishing a phase

When every work package is ✅ (or ⏸ with a target phase):

1. Run the full pipeline, the browser tests and a Docker stack check.
2. Paste the numbers into the phase file's **Acceptance evidence** section.
3. Tick the exit criteria and set the phase table to ✅.
4. Update the next gate in [STATUS.md](STATUS.md).

No evidence, no ✅.

## Status symbols

| Symbol | Meaning |
|---|---|
| ⬜ Pending | Not started |
| 🔄 In progress | Claimed; a draft pull request exists |
| 👀 In review | Pull request ready for review (or, for a phase, waiting to merge) |
| ✅ Done | Delivered with code and test paths; set in its own pull request, true on `main` once merged |
| ⛔ Blocked | Waiting on a named decision or person |
| ⏸ Deferred | Moved to a named later phase |

## Files both developers touch

| File | Rule |
|---|---|
| `backend/openapi.yaml` | Regenerate after every rebase; never hand-merge |
| `backend/requirements*.txt` | One pull request changes dependencies at a time; regenerate the lock after a rebase |
| `backend/config/settings.py`, `backend/config/urls.py` | Add lines only, one per module; rebase often |
| `backend/platform_core/` | Both review; announce a change before starting it |
| `frontend/src/features/organizer/api/*` | Each developer edits only their own page's entries |
| `backend/docs/STATUS.md` | Each developer edits only their own line |
| `backend/docs/ROADMAP.md`, `decisions/README.md` | Generated: never edit; run `check_tracker --write` |
