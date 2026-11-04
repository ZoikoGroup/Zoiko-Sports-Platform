# Zoiko Sports — Sign-in Platform

Zoiko Sports (Zoiko Tech Inc.) is a global sports operations platform. This
repository contains its first working slice: the **sign-in experience** for the
four workspaces — **Organization** (league / event), **Venue** (stadium / arena),
**Team / Club** and **Individual** (participant / staff) — plus registration,
email verification and password reset, backed by a session-based Django API.

The repository has exactly two top-level folders:

| Folder | Contents |
| --- | --- |
| [`frontend/`](.) | React + TypeScript single-page app, its nginx image, end-to-end tests. **This README.** |
| [`backend/`](../backend) | Django REST API, its Docker image, and the Docker Compose stack for the whole application. |

---

## Contents

1. [Architecture](#1-architecture)
2. [Folder structure](#2-folder-structure)
3. [Technology stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Run with Docker (recommended)](#5-run-with-docker-recommended)
6. [Run locally for development](#6-run-locally-for-development)
7. [Environment variables](#7-environment-variables)
8. [Frontend configuration](#8-frontend-configuration)
9. [Backend configuration and API](#9-backend-configuration-and-api)
10. [Authentication workflows](#10-authentication-workflows)
11. [Theme implementation (light / dark)](#11-theme-implementation-light--dark)
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
                                                       └── Django + DRF ──▶ SQLite (named volume)
```

* **Same origin.** The browser only ever talks to one origin (nginx in Docker,
  the Vite dev server locally). `/api` is proxied to Django, so the session and
  CSRF cookies are first-party and no CORS configuration is needed.
* **Session authentication.** Django sessions (HttpOnly cookie) plus CSRF
  protection on every state-changing request — including anonymous ones such as
  sign-in, which DRF would otherwise leave unprotected.
* **Workspace scoping.** A sign-in is always for one workspace. Organization,
  Venue and Team / Club require an active membership in an organization of that
  kind; Individual is a personal profile. The session records the chosen
  workspace and organization.
* **Backend is internal.** In Docker only nginx is published; the API container
  is reachable on the private Compose network.

## 2. Folder structure

```
backend/
  accounts/                 users, organizations, memberships, auth API
    management/commands/
      seed_demo.py          fictional demo organizations + accounts
    migrations/
    emails.py               verification / reset / "already registered" emails
    errors.py               single JSON error envelope for every API error
    models.py               User (email login), Organization, Membership
    serializers.py          request validation + session payload
    tokens.py               single-use verification and reset tokens
    urls.py, views.py       /api/v1/auth/* endpoints
    tests.py                API + seed-command tests
  config/                   Django settings, URLs, WSGI/ASGI
  Dockerfile                API image (gunicorn, non-root)
  docker-entrypoint.sh      secret key, migrations, optional demo seed
  docker-compose.yml        full stack (frontend + backend)
  .env.example              every supported setting, documented
  requirements.txt

frontend/
  src/
    api/                    fetch client (CSRF, error envelope) + typed endpoints
    auth/                   session context, the four account types
    components/
      AuthLayout.*          page frame: artboard, background plate, brand column, footer
      AccountTypeSelector.* the four workspace tiles (native radio group)
      SocialSignIn.*        Google / Microsoft / Apple / Company SSO + passkey
      CardHeader.*, Logo.tsx, icons/
      form/                 TextField, PasswordField, Checkbox, Button, Alert
    config/siteLinks.ts     footer destinations
    pages/                  Login, Register, ForgotPassword, ResetPassword,
                            VerifyEmail, Workspace
    assets/
      brand/                logo artwork extracted from the official images
      backgrounds/          stadium plate (desktop), stage (mobile), ambient fill
    index.css               design tokens + light/dark themes
  e2e/                      Playwright suite + isolated backend launcher
  Dockerfile, nginx.conf    production image
  playwright.config.ts, vite.config.ts, tsconfig*.json
```

## 3. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 7, Vite 8, React Router 7, lucide-react icons, self-hosted Inter + Poppins (Fontsource) |
| Styling | Plain CSS with design tokens and `prefers-color-scheme` themes; no CSS framework |
| Backend | Python 3.12, Django 5.2, Django REST Framework 3.16 |
| Serving | gunicorn (API), WhiteNoise (Django admin static files), nginx (SPA + reverse proxy) |
| Data | SQLite on a Docker named volume |
| Testing | Django test runner (API), Playwright on Microsoft Edge (end-to-end, three viewports, both themes) |
| Containers | Docker, Docker Compose v2 |

## 4. Prerequisites

* **Docker path:** Docker Desktop (or Docker Engine) with Compose v2 — `docker compose version`.
* **Local development path:**
  * Python **3.10+** (`python --version`)
  * Node.js **20.19+ / 22+** and npm (`node --version`)
  * Microsoft Edge or Google Chrome for the end-to-end tests

## 5. Run with Docker (recommended)

All Docker commands run from the **`backend/`** folder, which holds the Compose file.

### First start

```sh
cd backend

# 1. Create your local settings (never commit .env).
cp .env.example .env               # PowerShell: Copy-Item .env.example .env

# 2. Optional — demo accounts: in .env set
#      ZS_SEED_DEMO=true
#      ZS_DEMO_PASSWORD=<a password of your choice, 10+ characters>

# 3. Build the images and start the stack in the background.
docker compose up -d --build

# 4. Check both services report "healthy".
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
| Stop and **delete all data** (database, secret key) | `docker compose down -v` |

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
| Re-run the demo seed | `docker compose exec -e ZS_ALLOW_DEMO_SEED=true backend python manage.py seed_demo` |
| API health from the host | `curl http://localhost:8080/api/v1/auth/config/` |
| Web health from the host | `curl http://localhost:8080/healthz` |

### What the stack does on start

1. **backend** — the entrypoint creates a random `DJANGO_SECRET_KEY` on first
   start (unless you set one) and keeps it on the `backend-data` volume, applies
   migrations, optionally seeds demo data, then starts gunicorn with 3 workers
   as an unprivileged user. Its health check calls `/api/v1/auth/config/`.
2. **frontend** — starts only after the backend is healthy; nginx serves the
   app on port 8080 and proxies `/api`, `/admin` and `/static` to the backend.

## 6. Run locally for development

Two terminals. The Vite dev server proxies `/api` to Django on port 8000.

**Backend** (from `backend/`):

```sh
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
.venv/Scripts/python manage.py migrate

# Optional demo accounts (DEBUG is on by default locally):
#   PowerShell:  $env:ZS_DEMO_PASSWORD = "<your password>"
#   bash:        export ZS_DEMO_PASSWORD="<your password>"
.venv/Scripts/python manage.py seed_demo

.venv/Scripts/python manage.py runserver 127.0.0.1:8000
```

**Frontend** (from `frontend/`):

```sh
npm install
npm run dev            # http://127.0.0.1:5173/login
```

Verification and reset emails are printed in the backend terminal.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (app, config and tests) and build to `dist/` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright end-to-end suite |

## 7. Environment variables

### Docker stack — `backend/.env`

Copy `backend/.env.example`; every value is optional and has a safe default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ZS_HTTP_PORT` | `8080` | Host port of the web app |
| `ZS_PUBLIC_ORIGIN` | `http://localhost:8080` | Origin users open; used for CSRF trust and links in emails |
| `ZS_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Host names the API accepts |
| `DJANGO_SECRET_KEY` | *(generated)* | Leave empty to auto-generate and persist on the volume |
| `DJANGO_SECURE_COOKIES` | `false` | Set `true` when served over HTTPS |
| `AUTH_THROTTLE_RATE` | `10/min` | Sign-in / registration / reset attempts per client |
| `ZS_SEED_DEMO` | `false` | Create the fictional demo accounts on start |
| `ZS_DEMO_PASSWORD` | — | Required when seeding; must pass Django's password rules |
| `DJANGO_EMAIL_BACKEND` | console | `django.core.mail.backends.smtp.EmailBackend` for real email |
| `DJANGO_DEFAULT_FROM_EMAIL`, `DJANGO_EMAIL_HOST`, `DJANGO_EMAIL_PORT`, `DJANGO_EMAIL_HOST_USER`, `DJANGO_EMAIL_HOST_PASSWORD`, `DJANGO_EMAIL_USE_TLS` | — | SMTP settings |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_MICROSOFT_CLIENT_ID`, `AUTH_APPLE_CLIENT_ID`, `AUTH_SSO_METADATA_URL`, `AUTH_PASSKEYS_ENABLED` | — | Mark federated sign-in / passkeys as configured (see §10) |
| `VITE_LINK_PRIVACY`, `VITE_LINK_TERMS`, `VITE_LINK_SECURITY`, `VITE_LINK_ACCESSIBILITY`, `VITE_LINK_HELP` | — | Footer link targets, baked in at image build time |

### Backend settings read by Django

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_DEBUG` | `true` | Development mode. The Docker stack sets `false` |
| `DJANGO_SECRET_KEY` | dev-only key when `DEBUG` | **Required** when `DEBUG` is off |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated origins |
| `DJANGO_SECURE_COOKIES` | `not DEBUG` | HTTPS-only session and CSRF cookies |
| `DJANGO_SQLITE_PATH` | `backend/db.sqlite3` | Database file |
| `DJANGO_CACHE_DIR` | *(in-memory)* | Shared file cache (needed with several app-server workers) |
| `DJANGO_NUM_PROXIES` | `0` | Reverse proxies in front of the API (throttling keys on the real client IP) |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL for links in emails |
| `AUTH_THROTTLE_RATE` | `10/min` | Rate limit for the auth endpoints |
| `DJANGO_EMAIL_*`, `AUTH_*` | | As in the table above |

### Frontend (build / dev server)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the dev server proxies `/api` |
| `VITE_PORT` | `5173` | Dev server port |
| `VITE_LINK_*` | — | Footer links (unset links render as plain text, never as dead links) |

## 8. Frontend configuration

* **Routing** (`src/App.tsx`): `/login`, `/register`, `/forgot-password`,
  `/reset-password`, `/verify-email`, `/workspace`. Guest pages render
  immediately and redirect to `/workspace` if a session already exists;
  `/workspace` requires a session and returns to the requested page after sign-in.
* **API client** (`src/api/client.ts`): JSON over `fetch`, same-origin cookies,
  reads the `csrftoken` cookie before every unsafe request (Django rotates it on
  sign-in) and turns the backend error envelope into an `ApiError`.
* **Session state** (`src/auth/AuthContext.tsx`): loads `/session/` and
  `/config/` once, exposes `login` / `logout`.
* **Assets:** the logo and stadium images are derived from the official Zoiko
  Sports artwork — the logo is extracted, not redrawn; the card uses a navy-ink
  variant of the same artwork on the light theme.

## 9. Backend configuration and API

Base path: `/api/v1/auth/`. Every error has the shape
`{"error": {"code", "message", "fields"?}}`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `csrf/` | Sets the CSRF cookie |
| GET | `config/` | Account types, which federated providers are configured, passkey availability |
| GET | `session/` | `{"authenticated": false}` or the signed-in user, workspace, organization and memberships |
| POST | `login/` | `{email, password, account_type, remember}` |
| POST | `logout/` | Ends the session |
| POST | `register/` | `{full_name, email, password}` → always `202` |
| POST | `verify-email/` | `{uid, token}` — activates the account (single use) |
| POST | `verify-email/resend/` | `{email}` → always `202` |
| POST | `password-reset/` | `{email}` → always `202` |
| POST | `password-reset/confirm/` | `{uid, token, new_password}` (single use) |
| POST | `providers/<google\|microsoft\|apple\|sso>/start/` | Federated sign-in entry point (see §10) |

Data model: `User` (email is the username), `Organization` (`organizer`,
`venue`, `club`), `Membership` (user ↔ organization with role, status and
validity window).

## 10. Authentication workflows

**Workspace sign-in (the four options).** The user picks Organization, Venue,
Team / Club or Individual, then signs in with email and password. The server
checks the password and then that the account has an *active* membership (status,
validity window and organization all active) in an organization of that kind.
If not, it answers `workspace_unavailable` and lists the workspaces the account
does have; the page offers them as one-click choices. The last choice is
remembered on the device.

**Keep me signed in.** Checked: the session lasts 14 days. Unchecked: it ends
when the browser closes.

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

**Google, Microsoft, Apple, Company SSO and passkeys.** The buttons are part of
the design but no identity-provider integration exists yet. Each one tells the
user it is "not yet available"; setting a provider's variable only marks it as
configured — the server then reports "configured but not yet connected" until
the provider flow is implemented.

## 11. Theme implementation (light / dark)

Two themes share one layout:

* **Light** — the reference design: frosted white card, navy text, violet
  selection, yellow call to action.
* **Dark** — the same layout with a deep-navy glass card and light text.

### Choosing the theme

A **Light / System / Dark** switch sits in the top-right corner next to the
language selector.

| Choice | Behaviour |
| --- | --- |
| **System** (default) | Follows the operating-system / browser setting and changes live when it changes. Nothing is stored. |
| **Light** or **Dark** | Overrides the system setting. Stored in `localStorage` (`zs.theme`) and kept across reloads and visits; other open tabs update too. |

Choosing **System** again clears the stored choice and resumes following the OS.

### How it works

* `src/theme/theme.ts` resolves the choice to `light` or `dark` and writes it to
  `<html data-theme="…">`; it listens to `prefers-color-scheme` so "System"
  updates live. `src/components/ThemeToggle.tsx` is the switch — a native radio
  group, so it works with the keyboard (arrow keys) and screen readers.
* A tiny inline script in `index.html` applies the same rule **before first
  paint**, so the page never flashes the wrong theme.
* `src/index.css` defines semantic tokens (`--ink`, `--card-bg`, `--tile-bg`,
  `--field-border`, `--link`, alert colours, …); light values are the default and
  `:root[data-theme='dark']` overrides them. Components only use tokens, so every
  element switches together. `color-scheme` follows the theme so native controls
  (scrollbars, select menus, autofill) match.
* The card logo is a CSS background (`src/components/Logo.css`) keyed off the same
  attribute — navy lettering on light, white on dark; only the variant in use downloads.
* Switching cross-fades the whole page (View Transitions API, 0.35 s) where the
  browser supports it, instantly otherwise and when "reduce motion" is requested.
* The app mounts once the brand fonts are ready (capped at 800 ms), so text never
  reflows from a fallback font after first paint.
* Content on the stadium photograph (brand column, language selector, footer)
  stays white in both themes because the photograph is always dark.

To test the System mode, switch your OS between light and dark, or in Chrome / Edge
DevTools open *Rendering → Emulate CSS media feature prefers-color-scheme*.

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
* **Background.** A 2720 × 1454 stadium plate whose centre reproduces the
  reference framing; its extra width and grass cover 4:3 to 21:9 screens without
  empty bars. It scrolls with the content (no parallax drift).
* **Tablet / mobile** (< 1200px): a single column — brand, an in-flow "stage"
  framing the athletes, the card, then the platform areas. The large desktop
  artwork is not downloaded on phones.

## 13. Testing

**Backend** (from `backend/`):

```sh
.venv/Scripts/python manage.py test accounts
```

Covers sign-in to all four workspaces, refused workspaces, revoked memberships,
anti-enumeration, unverified accounts, remember-me, CSRF, rate limiting,
registration, verification, password reset and the demo seed command.

**End-to-end** (from `frontend/`):

```sh
npm run test:e2e
```

Playwright starts its own throwaway backend (port 8010, fresh database, random
demo password per run) and serves the production build with `vite preview`
(port 5183) — the same bundle Docker ships — then runs every journey at
desktop (1600 × 900), tablet (820 × 1180) and mobile (390 × 844): the four
workspace sign-ins, errors, registration and reset through real email links,
federated / passkey messaging, reference-geometry checks at 1280 × 720,
1600 × 900 and 1920 × 1080, layout stability while loading and scrolling, and
light, dark and live theme switching. It uses the installed Microsoft Edge; set
`E2E_BROWSER_CHANNEL=chrome` for Chrome.

## 14. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `port is already allocated` on start | Port 8080 is in use. Set `ZS_HTTP_PORT=8081` in `backend/.env`, then `docker compose up -d`. |
| `frontend` waits / never starts | It starts only when the backend is healthy: `docker compose ps`, then `docker compose logs backend`. |
| Sign-in shows "Your session expired. Refresh the page" | CSRF origin mismatch. If you open the app on another host or port, set `ZS_PUBLIC_ORIGIN` (and `ZS_ALLOWED_HOSTS`) to match, then `docker compose up -d`. |
| Signed in but immediately signed out | Secure cookies over plain HTTP. Keep `DJANGO_SECURE_COOKIES=false` unless the site is served over HTTPS. |
| "Too many attempts. Please wait N seconds" | The auth rate limit. Wait, or raise `AUTH_THROTTLE_RATE` for local testing. |
| No verification / reset email | With the default console backend, emails are in `docker compose logs backend`. Configure SMTP for real delivery. |
| Demo accounts missing | Set `ZS_SEED_DEMO=true` and a valid `ZS_DEMO_PASSWORD`, then `docker compose up -d` (or run the seed command above). The log explains a rejected password. |
| Code changes not visible in Docker | Images are built from source: `docker compose up -d --build`. |
| Start over with an empty database | `docker compose down -v`, then `docker compose up -d`. |
| `DJANGO_SECRET_KEY must be set` locally | You set `DJANGO_DEBUG=false` without a secret key; set one or leave debug on. |
| End-to-end tests cannot launch a browser | Install Edge, or `E2E_BROWSER_CHANNEL=chrome`, or `npx playwright install chromium` with `E2E_BROWSER_CHANNEL=`. |

## 15. Security notes

* Secrets live only in environment variables / `backend/.env` (git-ignored and
  excluded from both Docker build contexts). No password, key or token is
  committed, logged or baked into an image; the demo seed never prints its password.
* Containers run as unprivileged users; only nginx is published.
* nginx adds `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy` and `Permissions-Policy` headers.
* Serve the stack over HTTPS (terminating TLS in front of nginx) and set
  `DJANGO_SECURE_COOKIES=true` for any non-local deployment.
