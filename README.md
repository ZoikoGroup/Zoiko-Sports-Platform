# Zoiko Sports Platform

Zoiko Sports (Zoiko Tech Inc.) is a global sports operations platform. This
repository contains its first working slice: the **sign-in experience** for the
four workspaces — **Organization** (league / event), **Venue** (stadium / arena),
**Team / Club** and **Individual** (participant / staff) — plus registration,
email verification and password reset, backed by a session-based Django API.

The repository has two top-level folders, plus the GitHub Actions workflow
(`.github/` is the one agreed exception: GitHub only reads workflows there):

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | React + TypeScript single-page app, its nginx image and the end-to-end tests |
| [`backend/`](backend) | Django REST API, its Docker image, and the Docker Compose files for the whole application |
| [`.github/workflows/`](.github/workflows) | `ci.yml` — runs the CI pipelines and browser tests on every push and pull request |

**Project status and roadmap:** start at [`backend/docs/STATUS.md`](backend/docs/STATUS.md).
What is built, what remains (P0–P13), who is working on what, the decisions behind it and how
to continue all live in [`backend/docs/`](backend/docs/README.md), checked by CI.

---

## Quick start

**Once per machine** — create `backend/.env` from `backend/.env.example` and set
`POSTGRES_PASSWORD` to a long random value (the database refuses to start
without it):

```powershell
cd "<path-to-repo>\backend"; Copy-Item .env.example .env; python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Develop** — API and PostgreSQL in Docker, frontend with hot reload (PowerShell, Docker Desktop running):

```powershell
cd "<path-to-repo>\backend"; docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend; cd ..\frontend; npm run dev
```

Open **http://localhost:5173/login**. First time on a machine, run `npm install`
in `frontend/` once. For demo accounts, set these first (choose your own password):

```powershell
$env:ZS_SEED_DEMO="true"; $env:ZS_DEMO_PASSWORD="<your password, 10+ characters>"
```

**Run the full stack in Docker** (production build, served by nginx):

```powershell
cd "<path-to-repo>"; docker compose -f backend/docker-compose.yml up -d --build
```

Open **http://localhost:8080/login**. Details in [§5](#5-run-with-docker) and [§6](#6-run-for-development).

---

## Contents

1. [Architecture](#1-architecture)
2. [Folder structure](#2-folder-structure)
3. [Technology stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Run with Docker](#5-run-with-docker)
6. [Run for development](#6-run-for-development)
7. [Environment variables](#7-environment-variables)
8. [Frontend configuration](#8-frontend-configuration)
9. [Backend configuration and API](#9-backend-configuration-and-api)
10. [Authentication workflows](#10-authentication-workflows)
11. [Theme (light / dark) and theme toggle](#11-theme-light--dark-and-theme-toggle)
12. [Layout system](#12-layout-system)
13. [Testing](#13-testing)
14. [Troubleshooting](#14-troubleshooting)
15. [Security notes](#15-security-notes)

---

## 1. Architecture

```
 Browser ──HTTP──▶ frontend container (nginx :8080)
                   ├── /                → built React app (static files, SPA fallback)
                   └── /api /admin /static ──proxy──▶ backend container (gunicorn :8000)
                                                       └── Django + DRF ──▶ db container (PostgreSQL 16)
```

* **Same origin.** The browser only ever talks to one origin (nginx in Docker,
  the Vite dev server in development). `/api` is proxied to Django, so the
  session and CSRF cookies are first-party and no CORS configuration is needed.
* **Session authentication.** Django sessions (HttpOnly cookie) plus CSRF
  protection on every state-changing request — including anonymous ones such as
  sign-in, which DRF would otherwise leave unprotected.
* **Workspace scoping.** A sign-in is always for one workspace. Organization,
  Venue and Team / Club require an active membership in an organization of that
  kind; Individual is a personal profile. The session records the chosen
  workspace and organization.
* **Backend is internal.** In the full Docker stack only nginx is published; the
  API and database containers are reachable on the private Compose network. The
  development override publishes the API on `127.0.0.1:8000` for the Vite dev
  server and PostgreSQL on `127.0.0.1:5433` for host-side tools.
* **PostgreSQL 16 only.** Every environment — Docker, development on the host,
  backend tests, CI and the end-to-end suite — runs on PostgreSQL 16, through
  Django's built-in psycopg connection pool.
* **Observable.** Logs are JSON lines (Django and gunicorn alike); liveness and
  readiness probes are at `/api/v1/health/live/` and `/api/v1/health/ready/`.

## 2. Folder structure

```
backend/
  docs/                     project status, roadmap P0–P13, decisions, handover — start at STATUS.md
                            (every module also has a README.md describing itself)
  accounts/                 identity: users, sign-in, the active workspace context
    management/commands/
      seed_demo.py          fictional demo organizations + accounts
    migrations/             0003 moved Organization/Membership to organizations/
    emails.py               verification / reset / "already registered" emails
    models.py               User (email login, public UUID), AccountType
    middleware.py           re-checks the account and its workspace context on every request
    services.py, selectors.py  activate/forget a context; the session payload (public interface)
    serializers.py          request validation + response shapes
    tokens.py               single-use verification and reset tokens
    urls.py, me_urls.py, views.py  /api/v1/auth/* and /api/v1/me/* endpoints
    tests.py                API + seed-command tests
  organizations/            organizations, memberships, invitations, context resolution
    models.py               Organization (pending -> active -> suspended), Membership, Invitation
    selectors.py            eligible_contexts / find_context: who may act for what, right now
    services.py             create/verify/suspend organizations; invitations; membership status
    tokens.py, emails.py    invitation tokens (stored hashed) and the invitation email
    api/                    /api/v1/invitations/preview/ and accept/
    management/commands/
      organizations.py      operator commands: list, create, verify, suspend, invite, remove-member
    tests/                  contexts, sign-in, switching, revocation, invitations, migration
  platform_core/            platform kernel: shared conventions, no business rules (§9)
    request_context.py      per-request correlation ID (X-Request-ID)
    workspace.py            WorkspaceContext + HasWorkspaceContext permission for module views
    middleware.py           correlation ID; health probes answered before host validation
    errors.py               the JSON error envelope for every API error (DRF and Django level)
    models.py               base records (public UUID, timestamps, version); idempotency table
    concurrency.py          version-checked edits (409 version_conflict)
    idempotency.py          Idempotency-Key handling for creates
    pagination.py           cursor (keyset) pagination
    filtering.py            strict query-parameter filters
    timeutils.py, fields.py UTC, IANA time zones, daylight-saving-safe conversion; API fields
    openapi.py              shared OpenAPI pieces (error responses, Idempotency-Key header)
    boundaries.py, checks.py  module boundary rule as a `manage.py check` system check
    app_template/           template for new modules (`startapp --template`)
    tracker.py              validates backend/docs (`manage.py check_tracker`, run in CI)
    logging.py              JSON log formatter + request-ID log filter
    health.py, urls.py      /api/v1/health/live/ and /api/v1/health/ready/
    management/commands/
      wait_for_db.py        waits for PostgreSQL before migrations
      purge_idempotency_records.py  deletes expired idempotency records
    tests/                  kernel tests; reference/ is a test-only module using every convention
  config/                   Django settings, URLs, WSGI/ASGI
    database.py             PostgreSQL settings from DATABASE_* variables
  openapi.yaml              the reviewed API contract (CI fails when the code differs)
  scripts/ci.sh             the CI pipeline (lint → types → checks → schema → tests → audits → image scan)
  Dockerfile                API image (gunicorn, non-root, hash-verified dependencies)
  docker-entrypoint.sh      secret key, wait for database, migrations, optional demo seed
  gunicorn.conf.py          workers, timeouts, JSON access and error logs
  docker-compose.yml        full stack (frontend + backend + PostgreSQL 16)
  docker-compose.dev.yml    development override (API on 127.0.0.1:8000, database on 127.0.0.1:5433)
  .env.example              every supported setting, documented
  requirements.in / .txt    runtime dependencies / their hash-locked set
  requirements-dev.in / .txt  development and CI tools / their hash-locked set
  pyproject.toml            Python version, ruff, mypy and coverage settings
  .python-version           3.12

frontend/
  src/
    api/                    fetch client (CSRF, error envelope) + typed endpoints
    auth/                   session + workspace context, the four account types, workspace switching
    components/
      AuthLayout.*          page frame: artboard, background plate, brand column, footer
      AccountTypeSelector.* the four workspaces as one segmented bar (native radio group)
      SsoSignIn.*           "Sign in with SSO" below a dotted rule
      ThemeToggle.*         Light / System / Dark switch
      CardHeader.*, Logo.*, icons/
      form/                 TextField, PasswordField, Checkbox, Button, Alert
    theme/theme.ts          theme preference, persistence, system sync
    config/siteLinks.ts     footer destinations
    pages/                  Login, Register, ForgotPassword, ResetPassword, VerifyEmail,
                            Workspace, ChooseWorkspace, Invitation
    assets/
      brand/                logo artwork extracted from the official images
      backgrounds/          stadium plate (desktop), stage (mobile), ambient fill
    index.css               design tokens + light/dark themes
  e2e/                      Playwright suite, isolated backend launcher, warm-up, teardown
  scripts/ci.sh             frontend CI pipeline (lint → build → npm audit → image scan)
  Dockerfile, nginx.conf    production image (nginx mainline, unprivileged)
  playwright.config.ts, vite.config.ts, tsconfig*.json
```

## 3. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 7, Vite 8, React Router 7, lucide-react icons, self-hosted Inter + Poppins (Fontsource) |
| Styling | Plain CSS with design tokens and `data-theme` light/dark themes; no CSS framework |
| Backend | Python 3.12, Django 5.2 LTS, Django REST Framework 3.18, drf-spectacular (OpenAPI 3) |
| Serving | gunicorn (API), WhiteNoise (Django admin static files), nginx (SPA + reverse proxy) |
| Data | PostgreSQL 16 (Docker service and named volume), psycopg 3 with Django's connection pool |
| Testing | Django test runner + coverage (API), Playwright on Microsoft Edge (end-to-end, three viewports, both themes) |
| Quality | ruff (lint, format, security rules), mypy with Django/DRF stubs, pip-audit, oxlint, npm audit, Trivy image scans |
| CI | GitHub Actions (`.github/workflows/ci.yml`) running `backend/scripts/ci.sh` and `frontend/scripts/ci.sh` |
| Dependencies | Hash-locked requirement files compiled with uv |
| Containers | Docker, Docker Compose v2 |

## 4. Prerequisites

* **Docker:** Docker Desktop (or Docker Engine) with Compose v2 — `docker compose version`.
  Also needed for development: PostgreSQL 16 runs in Docker for the API, the
  backend tests, CI and the end-to-end suite.
* **Development:**
  * Node.js **20.19+ / 22+** and npm (`node --version`)
  * Python **3.12** — only to run the API, its tests or CI on the host. Without a
    system Python 3.12, uv provides one: `python -m pip install --user uv`, then
    `python -m uv python install 3.12`.
  * Microsoft Edge or Google Chrome for the end-to-end tests

## 5. Run with Docker

All Docker commands run from the **`backend/`** folder, which holds the Compose files.

### First start

```sh
cd backend

# 1. Create your local settings (never commit .env).
cp .env.example .env               # PowerShell: Copy-Item .env.example .env

# 2. Required — in .env set POSTGRES_PASSWORD to a long random value, e.g. from
#      python -c "import secrets; print(secrets.token_urlsafe(32))"
#    It is fixed when the database volume is first created.

# 3. Optional — demo accounts: in .env set
#      ZS_SEED_DEMO=true
#      ZS_DEMO_PASSWORD=<a password of your choice, 10+ characters>

# 4. Build the images and start the stack in the background.
docker compose up -d --build

# 5. Check all three services (db, backend, frontend) report "healthy".
docker compose ps
```

Open **http://localhost:8080/login**.

With demo seeding enabled, these fictional accounts all use your `ZS_DEMO_PASSWORD`:

| Account | Workspaces |
| --- | --- |
| `demo@zoikosports.test` | Organization (Riverside Invitational), Venue (Northfield Arena), Team / Club (Club A), Individual |
| `organizer@zoikosports.test` | Organization, Individual |
| `venue@zoikosports.test` | Venue, Individual |
| `club@zoikosports.test` | Team / Club, Individual |
| `individual@zoikosports.test` | Individual |

Without seeding, create an account at **/register**; the verification link is
printed in the backend log (see *Inspect* below).

### Everyday commands

| Task | Command (from `backend/`) |
| --- | --- |
| Build images | `docker compose build` |
| Start (build if needed) | `docker compose up -d` |
| Rebuild after code changes and restart | `docker compose up -d --build` |
| Stop (keep containers and data) | `docker compose stop` |
| Start stopped containers | `docker compose start` |
| Restart everything | `docker compose restart` |
| Restart one service | `docker compose restart backend` |
| Stop and remove containers (keep data) | `docker compose down` |
| Stop and **delete all data** (PostgreSQL volume, secret key) | `docker compose down -v` |

### Inspect

| Task | Command |
| --- | --- |
| Service status and health | `docker compose ps` |
| Follow all logs | `docker compose logs -f` |
| Backend logs (API requests, emails, errors) | `docker compose logs -f backend` |
| Frontend / nginx logs | `docker compose logs -f frontend` |
| Last 100 backend lines | `docker compose logs --tail 100 backend` |
| Resource usage | `docker stats` |
| Effective configuration | `docker compose config` |
| Shell in the API container | `docker compose exec backend sh` |
| Django management command | `docker compose exec backend python manage.py <command>` |
| Create an admin user (for /admin) | `docker compose exec backend python manage.py createsuperuser` |
| Re-run the demo seed (also resets the demo password) | `docker compose exec -T -e ZS_ALLOW_DEMO_SEED=true -e ZS_DEMO_PASSWORD="<password>" backend sh -c 'DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-$(cat /app/data/.secret_key)}" python manage.py seed_demo'` — management commands run through `exec` must load the container's generated secret key, as the entrypoint does |
| Database logs | `docker compose logs -f db` |
| SQL shell (psql) | `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |
| API liveness from the host | `curl http://localhost:8080/api/v1/health/live/` |
| API readiness (database + migrations) | `curl http://localhost:8080/api/v1/health/ready/` |
| Web health from the host | `curl http://localhost:8080/healthz` |

### What the stack does on start

1. **db** — PostgreSQL 16 initialises the `postgres-data` volume on first start
   (account and database from `POSTGRES_*`, SCRAM-SHA-256 passwords) and reports
   healthy once it accepts connections. It is not published outside Docker.
2. **backend** — starts once the database is healthy. The entrypoint creates a
   random `DJANGO_SECRET_KEY` on first start (unless you set one) and keeps it on
   the `backend-data` volume, waits for the database, applies migrations,
   optionally seeds demo data, then starts gunicorn (3 workers, JSON logs) as an
   unprivileged user. Its health check is the readiness probe
   `/api/v1/health/ready/`.
3. **frontend** — starts only after the backend is healthy; nginx serves the
   app on port 8080 and proxies `/api`, `/admin` and `/static` to the backend.

## 6. Run for development

### Option A — API in Docker, frontend with hot reload (recommended)

```powershell
cd "<path-to-repo>\backend"; docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend; cd ..\frontend; npm run dev
```

Open **http://localhost:5173/login**. Compose starts PostgreSQL first (the API
waits for it). `backend/docker-compose.dev.yml` publishes the API on
`127.0.0.1:8000` (the Vite dev server proxies `/api` there) and the database on
`127.0.0.1:5433`, and trusts the Vite origin for CSRF and email links. Code
changes in `frontend/` appear instantly. Needs `POSTGRES_PASSWORD` in
`backend/.env` (see *Quick start*).

* First time on a machine: `npm install` in `frontend/` before `npm run dev`.
* Demo accounts: set `$env:ZS_SEED_DEMO="true"` and
  `$env:ZS_DEMO_PASSWORD="<your password>"` before the `docker compose` command.
* Stop: `Ctrl + C` for the frontend, then in `backend/`:
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`.

### Option B — API on the host, PostgreSQL in Docker

Two terminals. The Vite dev server proxies `/api` to Django on port 8000.
Processes on the host read `backend/.env`, so with the `.env.example` defaults
(`DATABASE_HOST=127.0.0.1`, `DATABASE_PORT=5433`) they find the database below.

**Backend** (from `backend/`):

```sh
# Database only (PostgreSQL 16 on 127.0.0.1:5433).
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db

# Python 3.12 virtualenv from the hash-locked development set (once).
python -m uv venv .venv --python 3.12
python -m uv pip sync requirements-dev.txt --python .venv/Scripts/python.exe   # macOS/Linux: .venv/bin/python

.venv/Scripts/python manage.py migrate

# Optional demo accounts (needs DJANGO_DEBUG=true, as in .env.example): set ZS_DEMO_PASSWORD
# in backend/.env, or in the shell before running the command.
.venv/Scripts/python manage.py seed_demo

.venv/Scripts/python manage.py runserver 127.0.0.1:8000
```

Without uv: `py -3.12 -m venv .venv`, then
`.venv/Scripts/python -m pip install --require-hashes -r requirements-dev.txt`.

**Frontend** (from `frontend/`):

```sh
npm install
npm run dev            # http://127.0.0.1:5173/login
```

Verification and reset emails are printed in the backend terminal (or in
`docker compose logs backend` with Option A).

| Script (in `frontend/`) | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (app, config and tests) and build to `dist/` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright end-to-end suite |

## 7. Environment variables

### Docker stack — `backend/.env`

Copy `backend/.env.example`. `POSTGRES_PASSWORD` is required; every other value
is optional and has a safe default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | — | **Required.** Database account password, fixed when the `postgres-data` volume is first created |
| `POSTGRES_DB`, `POSTGRES_USER` | `zoiko` | Database and account created on first start |
| `ZS_DB_PORT` | `5433` | Host port of PostgreSQL with the development override (127.0.0.1 only) |
| `DATABASE_SSLMODE` | — | libpq `sslmode` for the API's database connection (e.g. `require` for a managed database) |
| `ZS_DB_WAIT_SECONDS` | `60` | How long the API container waits for the database on start |
| `GUNICORN_WORKERS`, `GUNICORN_TIMEOUT` | `3`, `30` | API worker processes and request timeout (seconds) |
| `GUNICORN_ACCESS_LOG` | `true` | JSON access log lines (method, path without query string, status, duration) |
| `ZS_HTTP_PORT` | `8080` | Host port of the web app |
| `ZS_PUBLIC_ORIGIN` | `http://localhost:8080` | Origin users open; used for CSRF trust and links in emails |
| `ZS_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Host names the API accepts (health probes answer regardless, so the container health check works with only your domain listed) |
| `ZS_API_PORT` | `8000` | Host port for the API with the development override |
| `DJANGO_SECRET_KEY` | *(generated)* | Leave empty to auto-generate and persist on the volume |
| `DJANGO_SECURE_COOKIES` | `false` | Set `true` when served over HTTPS |
| `AUTH_THROTTLE_RATE` | `10/min` | Sign-in / registration / reset attempts per client |
| `SESSION_REMEMBER_DAYS` | `14` | Lifetime of a "keep me signed in" session (1–90 days) |
| `INVITATION_TTL_DAYS`, `INVITATION_THROTTLE_RATE` | `7`, `30/min` | How long an emailed invitation link stays valid (1–30 days); invitation preview/accept attempts per client |
| `ZS_SEED_DEMO` | `false` | Create the fictional demo accounts on start |
| `ZS_DEMO_PASSWORD` | — | Required when seeding; must pass Django's password rules |
| `DJANGO_EMAIL_BACKEND` | console | `django.core.mail.backends.smtp.EmailBackend` for real email |
| `DJANGO_DEFAULT_FROM_EMAIL`, `DJANGO_EMAIL_HOST`, `DJANGO_EMAIL_PORT`, `DJANGO_EMAIL_HOST_USER`, `DJANGO_EMAIL_HOST_PASSWORD`, `DJANGO_EMAIL_USE_TLS` | — | SMTP settings |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_MICROSOFT_CLIENT_ID`, `AUTH_APPLE_CLIENT_ID`, `AUTH_SSO_METADATA_URL`, `AUTH_PASSKEYS_ENABLED` | — | Mark federated sign-in / passkeys as configured (see §10) |
| `VITE_LINK_PRIVACY`, `VITE_LINK_TERMS`, `VITE_LINK_SECURITY`, `VITE_LINK_ACCESSIBILITY`, `VITE_LINK_HELP` | — | Footer link targets, baked in at image build time |

### Backend settings read by Django

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_DEBUG` | `false` | Development mode. Off unless set to `true`; `.env.example` turns it on for local work, the Docker stack always sets `false`, CI sets `true` for its checks |
| `DJANGO_SECRET_KEY` | dev-only key when `DEBUG` | **Required** when `DEBUG` is off |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated origins |
| `DJANGO_SECURE_COOKIES` | `not DEBUG` | HTTPS-only session and CSRF cookies |
| `DATABASE_HOST`, `DATABASE_PORT` | `127.0.0.1`, `5432` | PostgreSQL server (`.env.example` sets port `5433` for the Docker database) |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials; fall back to the container variables, then `zoiko` / empty |
| `DATABASE_SSLMODE` | libpq default | e.g. `require`, `verify-full` |
| `DATABASE_CONNECT_TIMEOUT` | `5` | Seconds to wait for a new connection |
| `DATABASE_POOL` | `true` | Django's psycopg connection pool (`false` = persistent connections with health checks) |
| `DATABASE_POOL_MIN_SIZE`, `DATABASE_POOL_MAX_SIZE`, `DATABASE_POOL_TIMEOUT` | `1`, `10`, `10` | Pool size per process and seconds to wait for a free connection |
| `DATABASE_CONN_MAX_AGE` | `60` | Connection lifetime when the pool is off |
| `DATABASE_TEST_NAME` | `test_<name>` | Database the test runner creates |
| `DJANGO_READ_DOTENV` | `true` | Read `backend/.env` for host processes (real environment variables win); CI and the e2e harness set `false` |
| `DJANGO_LOG_FORMAT` | `text` with `DEBUG`, else `json` | `json` = one JSON object per line |
| `DJANGO_LOG_LEVEL` | `INFO` | Root log level |
| `DJANGO_CACHE_DIR` | *(in-memory)* | Shared file cache (needed with several app-server workers) |
| `DJANGO_NUM_PROXIES` | `0` | Reverse proxies in front of the API (throttling keys on the real client IP) |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL for links in emails |
| `AUTH_THROTTLE_RATE` | `10/min` | Rate limit for the auth endpoints |
| `API_PAGE_SIZE` | `25` | Default rows per page on list endpoints |
| `API_MAX_PAGE_SIZE` | `100` | Largest page a client may request (1–1000) |
| `IDEMPOTENCY_TTL_HOURS` | `24` | How long a create's stored result is replayed for a retried `Idempotency-Key` (1–720) |
| `SESSION_REMEMBER_DAYS` | `14` | "Keep me signed in" session lifetime in days (1–90) |
| `INVITATION_TTL_DAYS` | `7` | Invitation link lifetime in days (1–30) |
| `INVITATION_THROTTLE_RATE` | `30/min` | Rate limit for invitation preview and accept |
| `DJANGO_EMAIL_*`, `AUTH_*` | | As in the table above |

`API_PAGE_SIZE`, `API_MAX_PAGE_SIZE`, `IDEMPOTENCY_TTL_HOURS`, `SESSION_REMEMBER_DAYS`,
`INVITATION_TTL_DAYS` and `INVITATION_THROTTLE_RATE` are also passed through by the Docker stack (set them in `backend/.env`).

### Frontend (build / dev server)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the dev server proxies `/api` |
| `VITE_PORT` | `5173` | Dev server port |
| `VITE_LINK_*` | — | Footer links (unset links render as plain text, never as dead links) |

## 8. Frontend configuration

* **Routing** (`frontend/src/App.tsx`): `/login`, `/register`, `/forgot-password`,
  `/reset-password`, `/verify-email`, `/workspace`, `/organizer/*`. Guest pages
  render immediately and send a signed-in visitor to their home page;
  member pages require a session and return to the requested page after sign-in.
* **Role home pages** (`frontend/src/auth/roles.ts`): a session in the
  Organization workspace with an organizer membership lands on
  `/organizer/overview`; every other workspace lands on `/workspace`.
  `/organizer/*` is guarded by role, so other sessions are sent to their own
  home. This is UI routing only — organizer API endpoints must enforce access
  on the server when they are added.
* **Organizer Workspace** (`frontend/src/features/organizer/`, loaded as its own
  chunk): sidebar, top bar, the Overview dashboard, the Action Center
  (`/organizer/action-center`) and Competitions & Events
  (`/organizer/competitions`: directory with search and filters, a details
  panel, and Create Competition / Create Event forms; `?event=<id>`,
  `?new=competition` and `?new=event` open them directly) and Fixtures &
  Schedule (`/organizer/fixtures`: list and month calendar, conflicts, and the
  O-11 revision workflow UI — propose a change, compare old/new, request
  approval, recipient preview, publish with a reason. The server decides
  what is allowed (each fixture lists its `allowedActions`) and refuses a
  publication if the published version moved since the proposal.
  `?fixture=<id>`, `?new=fixture`, `?competition=<id>` and
  `?approvals=fixture` open or filter directly). The other sidebar modules
  render a "coming in a later build" page inside the same shell.
* **Organizer data** (`frontend/src/features/organizer/api/`): there is no
  sample data. Pages read and write only through `organizerApi.ts`, which
  runs the operations listed in `endpoints.ts`. Every entry there is `null`
  until the API specification defines it, so pages show their layout with
  "—" figures, empty lists and a "Live data isn't connected yet" notice, and
  form submissions report that saving is not available. `types.ts` holds the
  view models the screens render (map the agreed API responses onto them in
  `organizerApi.ts`); `empty.ts` holds the "no data" versions. Loading,
  error, empty and not-connected states come from `components/DataState.tsx`
  and the shared `useResource` hook in `frontend/src/api/resource.ts`.
* **API client** (`frontend/src/api/client.ts`): JSON over `fetch`, same-origin
  cookies, reads the `csrftoken` cookie before every unsafe request (Django
  rotates it on sign-in) and turns the backend error envelope into an `ApiError`.
* **Session state** (`frontend/src/auth/AuthContext.tsx`): loads `/session/` and
  `/config/` once, exposes `login` / `logout`.
* **Assets:** the logo and stadium images are derived from the official Zoiko
  Sports artwork — the logo is extracted, not redrawn. The sign-in card shows
  the logo tile alone; the other cards use the full wordmark, in a navy-ink
  variant on the light theme. The small brand logo is
  fetched first and decoded with the frame; the large stadium image decodes off
  the main thread, so it never delays the content above it.

## 9. Backend configuration and API

The full contract is [`backend/openapi.yaml`](backend/openapi.yaml) (OpenAPI 3,
generated from the code; with `DJANGO_DEBUG=true` it is also served at
`/api/v1/schema/`). CI fails when the code and the file differ: after an
intentional API change, review the difference and regenerate it with
`python manage.py spectacular --file openapi.yaml` (from `backend/`).

### Platform conventions (`backend/platform_core`)

Every module follows the same rules (errors, correlation IDs, public UUIDs, versioned
edits, idempotent creates, cursor pages, filters, time zones, workspace context, module
boundaries, migrations). They are listed in one place:
[`backend/docs/conventions.md`](backend/docs/conventions.md). How modules fit together is
in [`backend/docs/architecture.md`](backend/docs/architecture.md), and each module explains
itself in its own `README.md`.

### Authentication API

Base path: `/api/v1/auth/`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `csrf/` | Sets the CSRF cookie |
| GET | `config/` | Account types, configured federated providers, passkey availability, `session_remember_days` |
| GET | `session/` | `{"authenticated": false}` or the session (below) |
| POST | `login/` | `{email, password, account_type?, remember}` returns the session plus `preference_matched` |
| POST | `logout/` | Ends the session |
| POST | `register/` | `{full_name, email, password}`, always `202` |
| POST | `verify-email/` | `{uid, token}`: activates the account (single use) |
| POST | `verify-email/resend/` | `{email}`, always `202` |
| POST | `password-reset/` | `{email}`, always `202` |
| POST | `password-reset/confirm/` | `{uid, token, new_password}` (single use) |
| POST | `providers/<google\|microsoft\|apple\|sso>/start/` | Federated sign-in entry point (see §10) |

**The session** (returned by `session/`, `login/`, `/me/`, switching and
invitation acceptance):

```json
{
  "authenticated": true,
  "user": {"id": "<uuid>", "email": "maya@example.com", "full_name": "Maya"},
  "context": {"id": "<organization uuid>", "account_type": "organization",
              "organization": {"id": "<uuid>", "name": "Riverside Invitational", "kind": "organizer"},
              "role": "competition_director"},
  "contexts": ["...every workspace the account may act in, same shape..."],
  "context_status": "active | selection_required | no_access",
  "context_ended": false
}
```

**Signed-in identity and context.** Base path `/api/v1/me/` (sign-in required).

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/me/` | The session |
| GET | `contexts/` | `{"active", "contexts"}` |
| GET | `context/` | The active context, or `403 context_required` |
| PUT | `context/` | `{"context": "<id>"}`: switch. Re-verified against current memberships (`404 context_not_found` otherwise); the session ID is rotated and context-scoped session state dropped |

**Invitations.** Base path `/api/v1/invitations/` (CSRF-protected, rate-limited
by `INVITATION_THROTTLE_RATE`). The token travels in the request body, never in
a URL.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `preview/` | `{token}`: organization, workspace, role, masked address, expiry and `state` (`pending`, `expired`, `accepted`); no sign-in needed |
| POST | `accept/` | `{token}`, signed in as the invited address: joins and enters the workspace. Errors: `invitation_invalid`, `invitation_expired`, `invitation_used` (409), `invitation_email_mismatch` (403), `already_member` (409) |

Data model: `User` (email is the username), `Organization` (`organizer`,
`venue`, `club`; status `pending`, `active` or `suspended`), `Membership` (user
and organization with role, status and validity window) and `Invitation`
(single-use, expiring, token stored as a SHA-256 hash), stored in PostgreSQL 16.

**Operator commands** (until the Internal Administration product exists), run
from `backend/` (in Docker: `docker compose exec backend python manage.py ...`):

| Command | Effect |
| --- | --- |
| `organizations list` | Organizations with their IDs and status |
| `organizations create --name "..." --kind organizer\|venue\|club [--jurisdiction US-CA] [--verified]` | New organization, **pending** verification unless `--verified` |
| `organizations verify <id>` / `suspend <id>` / `reinstate <id>` | Verification and suspension; members of a suspended organization lose its workspace on their next request |
| `organizations invite <id> --email ... --role ... [--expires-days N]` | Emails a single-use invitation (the token is never printed); re-inviting replaces the earlier link |
| `organizations revoke-invitation <invitation id>` | Revokes a pending invitation |
| `organizations remove-member <id> --email ... [--suspend]` | Revokes (or suspends) a membership; effective on the member's next request |

**Health probes** — base path `/api/v1/health/`; no authentication, never
cached, `GET`/`HEAD` only. Bodies name each check and its state; failure
details go to the server log only. They are answered before host validation
(`platform_core/middleware.py`), because probes call the API by IP address;
every other URL still accepts only the hosts in `DJANGO_ALLOWED_HOSTS`.

| Endpoint | Answers | Use |
| --- | --- | --- |
| `live/` | `200 {"status": "ok"}` while the process serves requests; touches no dependency | Liveness: restart the container if it fails |
| `ready/` | `200` when the database answers and every migration is applied; otherwise `503` with `{"status": "unavailable", "checks": {"database", "migrations"}}` | Readiness: route traffic only to ready instances (the Docker health check) |

**Logging** — one JSON object per line on stdout (`timestamp`, `level`,
`logger`, `message`, `request_id`, plus fields such as `status_code`);
gunicorn's access lines add `method`, `path` (no query string), `status`,
`duration_ms` and the same `request_id`. Request objects, bodies, cookies and
headers are never logged. Set
`DJANGO_LOG_FORMAT=text` for readable local output (the default with `DEBUG`).

## 10. Authentication workflows

**Workspace sign-in (the four options).** Signing in authenticates the person;
it does not decide what they may act for. The server works out the account's
*workspace contexts* from verified data only: each active membership (status,
validity window, and an organization that is verified and not suspended) is one
context, plus the Individual workspace. Then:

- **one** candidate context: entered straight away;
- **several**: `context_status: selection_required`, and the app shows *Choose a workspace*;
- **none**: `no_access`, and the app says the account has no workspace yet.

The tile picked on the sign-in page (Organization, Venue, Team / Club,
Individual) is only a **preference**: it narrows the candidates when it matches
one of the account's contexts and never grants one. Picking a tile the account
lacks leads to the chooser with "This account doesn't have a ... workspace".
The last tile is remembered on the device.

**Switching workspace** (the sidebar menu in the Organizer workspace, *Switch
workspace* elsewhere) keeps the person signed in. The server re-verifies the
membership, rotates the session ID and drops everything stored for the previous
workspace; the app then reloads at the new workspace's home, so no data from the
previous workspace stays in memory.

**Losing access.** The active context is re-checked on every request. If the
membership is revoked or suspended, leaves its validity window, or the
organization is suspended, the very next request is refused (`403
context_required`) and the app returns to the chooser with "Your access to the
previous workspace has ended". Deactivating an account ends its sessions for good
(reactivation does not revive them); changing the password ends the other
sessions.

**Invitations.** Joining an organization takes an invitation; registration has
no role field, so nothing chosen at sign-up is a grant. An operator runs
`organizations invite`; the email links to `/invitations/accept#token=...`. The
token sits in the URL fragment, which browsers never send to a server, and the
page removes it from the address bar after reading it. The page shows the
organization, workspace and role; the person signs in (or registers, verifies,
and opens the link again) **with the invited address** and accepts. Links are
single-use, expire after `INVITATION_TTL_DAYS`, and only the newest invitation
for an address works.

**Keep me signed in.** Checked: the session lasts `SESSION_REMEMBER_DAYS` (14 by
default). Unchecked: it ends when the browser closes.

**Passwords** are hashed with Argon2id at OWASP's recommended minimum cost
(19 MiB, 2 passes, 1 lane; `accounts/hashers.py`), a fifth of Django's default
memory, so concurrent sign-ins cannot exhaust a small container. Accounts created
before P2 keep their PBKDF2 hash until their next successful sign-in, which
upgrades it.

**Registration and verification.** New accounts are created inactive and sent a
single-use verification link. Signing in before verifying returns
`email_not_verified`, with a "Resend verification email" action. Registering an
address that already exists sends that owner a notice instead — the response is
identical either way, so the form cannot reveal who has an account.

**Password reset.** Always answers "if an account exists…". The link is
single-use and expires; new passwords must pass Django's validators (10+
characters, not common, not all digits, not similar to the email).

**Error handling.** Wrong email and wrong password produce the same message.
Auth endpoints are rate-limited per client (`AUTH_THROTTLE_RATE`); behind nginx
the real client address is used, and the limit is shared across gunicorn workers.

**Company SSO (and other providers).** The sign-in page offers one
"Sign in with SSO" button, as in the design, but no identity-provider
integration exists yet: choosing it tells the user it is "not yet available".
Setting `AUTH_SSO_METADATA_URL` only marks SSO as configured — the server then
reports "configured but not yet connected" until the flow is implemented. The
API still accepts the Google, Microsoft, Apple and passkey settings for later
use; the current design shows no buttons for them.

## 11. Theme (light / dark) and theme toggle

Two themes share one layout:

* **Light** — the reference design: frosted white card, navy text, violet
  selection, yellow call to action.
* **Dark** — the same layout with a deep-navy glass card and light text.

### Choosing the theme

| Choice | Behaviour |
| --- | --- |
| **System** (default) | Follows the operating-system / browser setting and changes live when it changes. Nothing is stored. |
| **Light** or **Dark** | Overrides the system setting. Stored in `localStorage` (`zs.theme`) and kept across reloads and visits; other open tabs update too. |

Choosing **System** again clears the stored choice and resumes following the OS.

### The theme toggle

The switch sits in the top-right corner, next to the language selector
(`frontend/src/components/ThemeToggle.*`).

* **Always visible** — a pill showing all three options (sun = Light,
  monitor = System, moon = Dark), the active one in brand yellow, followed by a
  hairline and the language selector.
* **Mouse and touch** — one click or tap switches the theme. On touch screens
  each option is at least 44 × 44 px.
* **Keyboard and screen readers** — it is a native radio group: arrow keys
  switch and all three options are announced.
* **No layout shift** — switching theme changes colours only; nothing on the
  page moves.

### How the theme is applied

* `frontend/src/theme/theme.ts` resolves the choice to `light` or `dark` and
  writes it to `<html data-theme="…">`; it listens to `prefers-color-scheme` so
  "System" updates live.
* A small inline script in `frontend/index.html` applies the same rule **before
  first paint**, so the page never flashes the wrong theme.
* `frontend/src/index.css` defines semantic tokens (`--ink`, `--tile-bg`,
  `--field-border`, `--link`, alert colours, …); light values are the default and
  `:root[data-theme='dark']` overrides them. Components only use tokens, so every
  element switches together. `color-scheme` follows the theme so native controls
  (scrollbars, select menus, autofill) match.
* The card keeps both backgrounds as stacked layers and the theme sets which one
  is opaque, so its gradient cross-fades. The card logo is a CSS background keyed
  off the same attribute — navy lettering on light, white on dark.
* **Smooth switching.** On a theme change `theme.ts` adds a `.theme-switching`
  class for 0.4 s (counted from the first frame painted after the change). While
  it is present, the card and its contents ease colours, borders and background
  layers over 0.35 s. The rule is scoped to the moment of switching and to the
  card — the only part that differs between themes — so it never slows normal
  interactions or the first paint. With *reduce motion* requested the switch is
  instant.
* The app mounts once the brand fonts are ready (capped at 800 ms), so text never
  reflows from a fallback font after first paint.
* Content on the stadium photograph (brand column, language selector, footer)
  stays white in both themes because the photograph is always dark.

To test the System mode, switch your OS between light and dark, or in Chrome /
Edge DevTools open *Rendering → Emulate CSS media feature prefers-color-scheme*.

## 12. Layout system

The desktop layout reproduces the 1600 × 900 reference design and keeps its
proportions at every resolution:

* **Artboard.** At widths ≥ 1200px the page is a 1600 × 900 artboard. Every
  size is a multiple of `--u`, one reference pixel:
  `--u = clamp(0.75px, min(100cqw / 1600, 100vh / 900), 1.3px)`. The whole
  composition scales as one unit — nothing reflows or overlaps between sizes.
  Measured against the reference at 1600 × 900, every element is within 3px.
* **Size tokens.** Components read `--s-*` tokens declared on `.auth-shell`;
  mobile and tablet set them in pixels, desktop in `--u`. Components carry no
  breakpoint overrides of their own.
* **Wider than 16:9** (e.g. 1920 × 1080 screens minus browser chrome, 21:9
  monitors): the artboard stretches to the full window width. The brand column
  keeps its 62-unit left margin and the card its 93-unit right margin, exactly as
  in the reference; the extra width goes to the centre around the athletes, and
  the shading covers the whole background so there are no side bands.
* **Footer.** As in the reference: a yellow rule, the five links with yellow
  separators, and a yellow rule, on one line centred under the card (rules 29
  units wide, 18 from the links). It never wraps on desktop.
* **Background.** A 2720 × 1454 stadium plate whose centre reproduces the
  reference framing; its extra width and grass cover 4:3 to 21:9 screens without
  empty bars. It scrolls with the content (no parallax drift).
* **Tablet / mobile** (< 1200px): a single column — brand, an in-flow "stage"
  framing the athletes, the card, then the platform areas. The large desktop
  artwork is not downloaded on phones.

## 13. Testing

**Backend CI pipeline** (from any folder, in Git Bash on Windows or any
Linux/macOS shell; needs Docker and the virtualenv from §6):

```sh
backend/scripts/ci.sh                 # everything (about 4 minutes)
CI_SKIP_IMAGE=1 backend/scripts/ci.sh # without the image build and scan
```

Steps, each of which must pass:

1. ruff lint (including security rules) and format check
2. mypy type check (Django and DRF plugins)
3. a throwaway PostgreSQL 16 container with a random password (or the database
   in `DATABASE_*` when `DATABASE_HOST` is set, e.g. a CI service container)
4. Django system checks (including the module boundary rule), and a check that
   migrations match the models
5. the OpenAPI schema generates with zero warnings and matches `openapi.yaml`
6. all backend tests with branch coverage (must stay at 85% or more)
7. pip-audit on both hash-locked requirement files (no known vulnerabilities)
8. image build, then a Trivy scan that fails on HIGH or CRITICAL vulnerabilities
   with a fix available

**Frontend CI pipeline** (from any folder, after `npm install` in `frontend/`):

```sh
frontend/scripts/ci.sh                 # everything (about 1 minute)
CI_SKIP_IMAGE=1 frontend/scripts/ci.sh # without the image build and scan
```

Steps: oxlint; TypeScript type check and production build; `npm audit`
(fails on high or critical); image build; Trivy scan of the nginx image
(fails on fixable HIGH or CRITICAL vulnerabilities — the image upgrades its
Alpine packages at build time for this reason).

**GitHub Actions** (`.github/workflows/ci.yml`) runs both pipelines as the
jobs `backend` and `frontend` on every push and on pull requests to `main`;
`main` should require both to pass before merging. The end-to-end suite is
not part of CI yet; run it locally before merging larger changes.

The tests alone, against the development database (§6, Option B):

```sh
.venv/Scripts/python manage.py test
```

They cover sign-in to all four workspaces, refused workspaces, revoked
memberships, anti-enumeration, unverified accounts, remember-me, CSRF, rate
limiting, registration, verification, password reset, the demo seed command,
database settings, JSON logging, both health probes (including database down
and pending migrations) and `wait_for_db`; and the platform kernel: correlation
IDs in responses and logs, the error envelope for every error type, public IDs,
version conflicts (including two truly simultaneous edits), idempotent creates
(including ten simultaneous duplicates), cursor pagination over 1,000 rows that
share a timestamp (forwards and backwards, constant query count), strict
filters, IANA time zones and daylight-saving gaps and overlaps in four zones,
the OpenAPI contract, the module boundary rule and the module template.

**Changing dependencies:** edit `requirements.in` (runtime) or
`requirements-dev.in` (tools), then regenerate the locks with the command at the
top of each file and re-sync the virtualenv.

**End-to-end** (from `frontend/`):

```sh
npm run test:e2e
```

Playwright starts its own throwaway backend (port 8010; a fresh PostgreSQL 16
container with a random password, removed after the run — so Docker must be
running; random demo password per run), warms it up with one real sign-in, and serves the
production build with `vite preview` (port 5183) — the same bundle Docker
ships. It then runs every journey at desktop (1600 × 900), tablet (820 × 1180)
and mobile (390 × 844):

* the four workspace sign-ins, errors, registration and reset through real email links;
* single sign-on "not yet available" messaging;
* reference-geometry checks at 1280 × 720, 1600 × 900 and 1920 × 1080, plus
  edge margins at 1850 × 958 and 2560 × 1080;
* layout stability while loading (cumulative layout shift) and scrolling;
* light, dark, manual and live system theme switching, persistence and
  first-paint theme;
* the theme toggle: all three options visible, mouse, touch and keyboard,
  44px touch targets, and no layout shift.

It uses the installed Microsoft Edge; set `E2E_BROWSER_CHANNEL=chrome` for Chrome.

## 14. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `port is already allocated` on start | Port 8080 (or 8000 with the dev override) is in use. Set `ZS_HTTP_PORT` / `ZS_API_PORT` in `backend/.env`, then start again. |
| `npm run dev` says port 5173 is in use | Another dev server is running; stop it, or start with `$env:VITE_PORT="5174"`. |
| `frontend` waits / never starts | It starts only when the backend is healthy: `docker compose ps`, then `docker compose logs backend`. |
| Sign-in shows "Your session expired. Refresh the page" | CSRF origin mismatch. If you open the app on another host or port, set `ZS_PUBLIC_ORIGIN` (and `ZS_ALLOWED_HOSTS`) to match, then `docker compose up -d`. |
| Signed in but immediately signed out | Secure cookies over plain HTTP. Keep `DJANGO_SECURE_COOKIES=false` unless the site is served over HTTPS. |
| "Too many attempts. Please wait N seconds" | The auth rate limit. Wait, or raise `AUTH_THROTTLE_RATE` for local testing. |
| No verification / reset email | With the default console backend, emails are in `docker compose logs backend`. Configure SMTP for real delivery. |
| Demo accounts missing | Set `ZS_SEED_DEMO=true` and a valid `ZS_DEMO_PASSWORD`, then `docker compose up -d` (or run the seed command above). The log explains a rejected password. |
| Code changes not visible in Docker | Images are built from source: `docker compose up -d --build`. |
| Start over with an empty database | `docker compose down -v`, then `docker compose up -d`. |
| `Set POSTGRES_PASSWORD in backend/.env` when starting | Create `backend/.env` from `.env.example` and set `POSTGRES_PASSWORD`. |
| `password authentication failed` after changing `POSTGRES_PASSWORD` | The password is fixed when the volume is created. Change it back, or start over with `docker compose down -v`. |
| `manage.py` / tests on the host cannot connect | Start the database (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db`) and check `DATABASE_HOST=127.0.0.1` / `DATABASE_PORT=5433` in `backend/.env`. Port 5432 is often taken by a locally installed PostgreSQL. |
| Readiness probe answers `503` | `docker compose logs backend` names the failing check: database unreachable, or migrations not applied. |
| End-to-end suite fails with `couldn't get a connection` | Its database container stopped responding — usually Docker itself. Check `docker version` answers; restart Docker Desktop if not. |
| `DJANGO_SECRET_KEY must be set` locally | Debug is off unless enabled. Set `DJANGO_DEBUG=true` in `backend/.env` (as in `.env.example`) for local work, or set a secret key. |
| End-to-end tests cannot launch a browser | Install Edge, or `E2E_BROWSER_CHANNEL=chrome`, or `npx playwright install chromium` with `E2E_BROWSER_CHANNEL=`. |

## 15. Security notes

* Secrets live only in environment variables / `backend/.env` (git-ignored and
  excluded from both Docker build contexts). No password, key or token is
  committed, logged or baked into an image; the demo seed never prints its password.
* Containers run as unprivileged users; in the full stack only nginx is
  published, and the development override binds the API and database to
  `127.0.0.1` only.
* PostgreSQL uses SCRAM-SHA-256 password authentication and is never published
  outside Docker in the full stack. Its password is required and has no default.
* Every Python dependency is pinned and hash-verified (`--require-hashes`) in
  the image and the virtualenv; CI fails on known vulnerabilities (pip-audit)
  and on fixable HIGH/CRITICAL vulnerabilities in the image (Trivy, pinned by
  digest).
* Logs never contain request objects, bodies, cookies, headers or query strings;
  health probes never reveal failure details to callers.
* nginx adds `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy` and `Permissions-Policy` headers.
* Serve the stack over HTTPS (terminating TLS in front of nginx) and set
  `DJANGO_SECURE_COOKIES=true` for any non-local deployment.
