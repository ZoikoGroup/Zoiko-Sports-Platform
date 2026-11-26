# P0 — Engineering foundation

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P0 | 🔄 In progress | A | — | D-001 to D-011, D-013 | Every later phase |

**Objective:** a reproducible environment, PostgreSQL 16, quality tooling and CI that every later phase relies on.

**Layer:** L0. Merged to `main` in PR #2 (`1bc221c`, 2026-11-21).

## Work packages

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P0.1 | One Python version (3.12) for local, CI and Docker | ✅ Done | A | — | PR #2 (1bc221c) |
| P0.2 | Hash-locked dependencies (runtime and development sets) | ✅ Done | A | — | PR #2 (1bc221c) |
| P0.3 | PostgreSQL 16 in Docker Compose; settings from environment | ✅ Done | A | — | PR #2 (1bc221c) |
| P0.4 | Browser tests run against a throwaway PostgreSQL 16 | ✅ Done | A | P0.3 | PR #2 (1bc221c) |
| P0.5 | Tooling: ruff, mypy, coverage | ✅ Done | A | P0.1 | PR #2 (1bc221c) |
| P0.6 | CI pipeline (GitHub Actions: backend and frontend jobs) | ✅ Done | A | P0.5 | PR #2 (1bc221c) |
| P0.7 | JSON logging; liveness and readiness probes | ✅ Done | A | P0.3 | PR #2 (1bc221c) |
| P0.8 | Decision log (moved into the repository in Stage 0) | ✅ Done | A | — | PR #4 (d18900a) |
| P0.9 | `main` protected: pull requests with green CI only | ⛔ Blocked | Repo admin | P0.6 | — |

### P0.1 One Python version
- **Code:** `backend/.python-version`, `backend/Dockerfile`, `backend/pyproject.toml`
- **Tests:** `backend/scripts/ci.sh`
- Decision: D-003.

### P0.2 Hash-locked dependencies
- **Code:** `backend/requirements.in`, `backend/requirements.txt`, `backend/requirements-dev.in`, `backend/requirements-dev.txt`, `frontend/package-lock.json`
- **Tests:** `.github/workflows/ci.yml`, `backend/scripts/ci.sh`
- CI installs with `--require-hashes`; `pip-audit` and `npm audit` run on every push. Decision: D-005.

### P0.3 PostgreSQL 16
- **Code:** `backend/docker-compose.yml`, `backend/docker-compose.dev.yml`, `backend/config/database.py`
- **Tests:** `backend/platform_core/tests/test_foundation.py`
- Decisions: D-002, D-004.

### P0.4 Browser tests on PostgreSQL 16
- **Code:** `frontend/e2e/start-backend.mjs`, `frontend/playwright.config.ts`
- **Tests:** `frontend/e2e/auth.spec.ts`

### P0.5 Tooling
- **Code:** `backend/pyproject.toml`
- **Tests:** `backend/scripts/ci.sh`
- The roadmap suggested pytest; the project kept Django's test runner (same coverage gate, 85%).

### P0.6 CI pipeline
- **Code:** `.github/workflows/ci.yml`, `backend/scripts/ci.sh`, `frontend/scripts/ci.sh`
- **Tests:** `.github/workflows/ci.yml`
- Decisions: D-006, D-010.

### P0.7 Logging and health
- **Code:** `backend/platform_core/logging.py`, `backend/platform_core/health.py`, `backend/platform_core/middleware.py`, `backend/gunicorn.conf.py`
- **Tests:** `backend/platform_core/tests/test_foundation.py`, `backend/platform_core/tests/test_request_context.py`
- Decisions: D-008, D-009.

### P0.8 Decision log
- **Code:** `backend/docs/decisions/`, `backend/platform_core/tracker.py`
- **Tests:** `backend/platform_core/tests/test_tracker.py`
- Was a Claude Doc (D-012); D-022 moves it into the repository so code and decisions are versioned together.

### P0.9 Branch protection
- Needs a repository admin: protect `main`; require the `backend`, `frontend`, `e2e` and `tracker` checks and one approving review.
- Decisions: D-007, D-013.

## Acceptance criteria

- [x] A new developer runs the stack and all tests from the README alone.
- [x] CI takes under 10 minutes (backend 162 s without the image scan, 2026-11-26).
- [x] OpenAPI generates with zero warnings.
- [x] `/health/ready/` fails when the database is down (`test_foundation.py`).
- [ ] `main` accepts only reviewed pull requests with green CI (P0.9).

## Acceptance evidence

- 2026-11-21: PR #2 merged; GitHub CI green on `main`.
- 2026-11-26: `scripts/ci.sh` (image scan skipped) passed: ruff, mypy (103 files), checks, migrations, schema, 202 tests OK, 94% coverage, `pip-audit` clean.
- 2026-11-26 (Stage 0, local): backend `scripts/ci.sh` with image build and Trivy scan passed (tracker check OK, 230 tests, 95% coverage); frontend `scripts/ci.sh` passed (0 npm vulnerabilities, image scan clean); browser tests 172 passed, 14 skipped, 0 failed. The new GitHub `e2e` job is proven only once it runs on GitHub.

## Progress log

- 2026-11-20 · P0.1–P0.7 · dd96088 · foundation built.
- 2026-11-21 · P0.6 · PR #2 · GitHub Actions; frontend checks join CI. Next: branch protection (admin).
- 2026-11-26 · P0.8 · Stage 0 · decision log moved into `backend/docs/decisions/`; tracker checked in CI (`check_tracker`); browser tests added to GitHub CI as the `e2e` job (D-037); Organizer browser tests split into one file per page (`frontend/e2e/organizer/`). Next: push with P2, open the pull request, protect `main`.
- 2026-11-26 · P0.8 · Stage 0 · tracker enforced on pull requests (D-038): titles name their work package, code arrives with its tracker update; ROADMAP shows overall progress and recent work.
