# P2 — Identity and organization context

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P2 | ✅ Done | A | P1 | D-024 to D-032 | Workspace chooser, switching without sign-out, invitations |

**Objective:** the server decides which organization a person is acting for, re-checks it on every request, and lets people join organizations by invitation.

**Layer:** L2. Built as `9b8838b` (backend) and `b44873b` (frontend); merged to `main` in PR #4 (`2e11f4c`).

## Work packages

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P2.1 | `organizations` module separated from `accounts`; verification status | ✅ Done | A | P1 | PR #4 (9b8838b) |
| P2.2 | Context resolver at sign-in (1 → enter, several → choose, none → no access) | ✅ Done | A | P2.1 | PR #4 (9b8838b) |
| P2.3 | Context endpoints and switching without sign-out | ✅ Done | A | P2.2 | PR #4 (9b8838b, b44873b) |
| P2.4 | Access re-checked on every request | ✅ Done | A | P2.2 | PR #4 (9b8838b) |
| P2.5 | Invitations: single-use, expiring, stored hashed | ✅ Done | A | P2.1 | PR #4 (9b8838b, b44873b) |
| P2.6 | Credential hardening: Argon2id, configurable session length | ✅ Done | A | P1 | PR #4 (9b8838b) |
| P2.7 | Self-service invitation API (organization admins invite) | ⏸ Deferred | A | P3 | → P12.3 |

### P2.1 Organizations module
- **Code:** `backend/organizations/models.py`, `backend/organizations/migrations/`, `backend/accounts/migrations/0003_move_organizations.py`
- **Tests:** `backend/organizations/tests/test_migrations.py`, `backend/organizations/tests/test_module.py`
- Tables were moved without data loss (rehearsed on a copy of a P1 database). New organizations start `pending` (D-025).

### P2.2 Context resolver at sign-in
- **Code:** `backend/organizations/selectors.py`, `backend/accounts/views.py`, `backend/accounts/selectors.py`
- **Tests:** `backend/organizations/tests/test_contexts.py`, `backend/organizations/tests/test_identity_api.py`
- The sign-in tile is a preference only (D-030); the Individual workspace is kept (D-024).

### P2.3 Context endpoints and switching
- **Code:** `backend/accounts/views.py`, `backend/accounts/me_urls.py`, `backend/accounts/services.py`, `frontend/src/pages/ChooseWorkspacePage.tsx`, `frontend/src/auth/useSwitchWorkspace.ts`
- **Tests:** `backend/organizations/tests/test_identity_api.py`, `frontend/e2e/auth.spec.ts`
- API: `GET /api/v1/me/`, `GET /api/v1/me/contexts/`, `GET`/`PUT /api/v1/me/context/`. Switching rotates the session and drops workspace-scoped session data.

### P2.4 Access re-checked on every request
- **Code:** `backend/accounts/middleware.py`, `backend/platform_core/workspace.py`
- **Tests:** `backend/organizations/tests/test_identity_api.py`
- A removed or suspended member gets `403 context_required` on the next request; a deactivated account's session is ended.

### P2.5 Invitations
- **Code:** `backend/organizations/services.py`, `backend/organizations/tokens.py`, `backend/organizations/emails.py`, `backend/organizations/api/`, `backend/organizations/management/commands/organizations.py`, `frontend/src/pages/InvitationPage.tsx`
- **Tests:** `backend/organizations/tests/test_invitations.py`, `backend/organizations/tests/test_commands.py`, `frontend/e2e/auth.spec.ts`
- API: `POST /api/v1/invitations/preview/`, `POST /api/v1/invitations/accept/`. Decisions: D-026, D-027, D-028.

### P2.6 Credential hardening
- **Code:** `backend/accounts/hashers.py`, `backend/config/settings.py`
- **Tests:** `backend/accounts/tests.py`
- Decisions: D-029, D-031.

### P2.7 Self-service invitation API
- Needs the permission engine (P3) to decide who may invite; built with Team & Access in P12.3 (D-032). Until then, operators use `manage.py organizations invite`.

## Acceptance criteria

- [x] One eligible context → straight in; several → chooser; none → no-access page.
- [x] A tile the account lacks grants nothing.
- [x] A removed member's next request is denied.
- [x] Invitation tokens are single-use, expire, and only their SHA-256 hash is stored.
- [x] Existing passwords upgrade to Argon2id on next sign-in.
- [x] Sign-in, switching and invitation events are audited (delivered by P3.7).
- [x] Merged to `main` (PR #4).

## Acceptance evidence

- 2026-11-25: backend pipeline 202 tests OK (2 skipped), 94% coverage, `pip-audit` and Trivy clean; frontend pipeline green.
- 2026-11-25: browser tests 170 passed, 14 skipped, 2 timeouts that passed when re-run alone.
- 2026-11-25: Docker stack check 31/31 (through nginx: sign-in, switching, invitations, removal, logs).
- 2026-11-25: upgrade rehearsal from a P1 database with seed data: data intact, content types moved, PBKDF2 → Argon2id on sign-in.
- 2026-11-25: GitHub CI on `b44873b`: backend and frontend green.

## Progress log

- 2026-11-25 · P2.1–P2.6 · 9b8838b, b44873b · identity and organization context; pushed to `vivekkumar`. Merged in PR #4.
- 2026-11-26 · P2.5 · Stage 0 · fixed a first-visit CSRF race: an invitation link opened in a fresh browser could be refused ("session expired") because two responses set different CSRF cookies. `frontend/src/api/client.ts` now shares one token bootstrap and retries once on `csrf_failed`. Found by the browser suite.
- 2026-11-26 · P2.1 · vivekkumar (PR to open) · schema corrections (D-046): database CHECK constraints for values and states, redundant indexes removed, housekeeping scheduled.
