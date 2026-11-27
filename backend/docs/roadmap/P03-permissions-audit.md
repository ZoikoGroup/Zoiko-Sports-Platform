# P3 — Permissions and audit trail

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P3 | ✅ Done | A | P2 | D-039, D-042, D-043, D-045 (GP1 assumed) | Secures every later endpoint |

**Objective:** one permission engine and one tamper-resistant audit trail that every later module plugs into.

**Layer:** L2. **Track:** domain (A). Built together with P4 (one command, "Implement P3 & P4").

**Entry criteria:** P2 merged to `main` (PR #4, `2e11f4c`). ✅

**Company decision:** GP1, the role catalogue. Seeded with the roles the documents name (D-039, assumed); changing it later is a data change.

**Source requirements:** FSD §11 permission matrix, HO §09 access formula, RBAC §03 and A01–A16, FSD T17/T18; gaps GP1, GP2, GS8.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P3.1 | Role, permission and participation-profile tables (roles as data) | ✅ Done | A | P2 | PR #5 |
| P3.2 | Policy engine: "may this actor do this to that?" | ✅ Done | A | P3.1 | PR #5 |
| P3.3 | Scoped queries: lists, counts, search and exports start from visible rows | ✅ Done | A | P3.2 | PR #5 |
| P3.4 | Response rule: hidden → 404, visible but forbidden → 403 | ✅ Done | A | P3.2 | PR #5 |
| P3.5 | Allowed actions listed for each record | ✅ Done | A | P3.2 | PR #5 |
| P3.6 | Deny by default: the build fails if an endpoint has no permission rule | ✅ Done | A | P3.2 | PR #5 |
| P3.7 | Append-only audit trail (database-enforced) | ✅ Done | A | P3.1 | PR #5 |
| P3.8 | Permission-matrix test harness on the golden event (adds Club B and uninvited Club C) | ✅ Done | A | P3.2–P3.6 | PR #5 |
| P3.9 | Django `/admin/` limited to Zoiko staff | ✅ Done | A | — | PR #5 |

### P3.1 Role and permission tables
- **Code:** `backend/access/models.py`, `backend/access/migrations/0002_seed_catalogue.py`, `backend/organizations/migrations/0003_roles_from_catalogue.py`, `backend/access/management/commands/access.py`
- **Tests:** `backend/access/tests/test_policy.py`, `backend/organizations/tests/test_migrations.py`
- `Membership.role` and `Invitation.role` are now links to `access.Role` (the column keeps the role code). Roles existing members already had but the catalogue lacks are kept as non-assignable legacy roles with no permissions. Only roles offered for an organization's kind can be given.

### P3.2 Policy engine
- **Code:** `backend/access/selectors.py`, `backend/access/services.py`, `backend/access/apps.py`, `backend/platform_core/authorization.py`
- **Tests:** `backend/access/tests/test_policy.py`, `backend/platform_core/tests/test_authorization.py`
- Order: workspace (membership re-checked every request) → participation gate (registered by P5) → role grants → profile grants (other organizations' records) → shared fields. Without the engine installed every check is denied.

### P3.3 Scoped queries
- **Code:** `backend/access/selectors.py`, `backend/activity/selectors.py`
- **Tests:** `backend/access/tests/test_policy.py`, `backend/access/tests/test_permission_matrix.py`
- `scope_to_context()`; the activity feed is the first list built on it.

### P3.4 404 versus 403
- **Code:** `backend/platform_core/authorization.py`
- **Tests:** `backend/access/tests/test_policy.py`, `backend/platform_core/tests/test_authorization.py`
- `deny(visible=…)`; `RequirePermission` answers 403 `permission_denied`, or 403 `context_required` without a workspace.

### P3.5 Allowed actions
- **Code:** `backend/platform_core/authorization.py`, `backend/accounts/selectors.py`, `frontend/src/auth/roles.ts`
- **Tests:** `backend/access/tests/test_policy.py`, `backend/access/tests/test_permission_matrix.py`
- `allowed_actions(context, actions, resource)` for records (used by P5/P6 endpoints); the session lists the active role's `permissions` and each context its `role_name` (D-045).

### P3.6 Deny by default
- **Code:** `backend/platform_core/checks.py`, `backend/platform_core/health.py`
- **Tests:** `backend/platform_core/tests/test_authorization.py`
- System check `platform_core.E002`: every `/api/` endpoint states its own permission rule (`Public` for anonymous ones, `@public_endpoint` for plain Django views).

### P3.7 Audit trail
- **Code:** `backend/audit/`, `backend/accounts/signals.py`, `backend/accounts/services.py`, `backend/organizations/services.py`
- **Tests:** `backend/audit/tests/test_audit.py`
- A trigger blocks UPDATE and DELETE (proved with the ORM and raw SQL). Back-fills P2: sign-in, failed sign-in, sign-out, context switch and end, every invitation step including refusals, organization and membership changes, account events (D-042).

### P3.8 Permission-matrix harness
- **Code:** `backend/access/tests/golden.py`, `backend/accounts/management/commands/seed_demo.py`
- **Tests:** `backend/access/tests/test_permission_matrix.py`
- 12 actors × every API endpoint, including denials; fails when an endpoint is added without a matrix entry. Clubs B and C are in the demo seed and the fixture.

### P3.9 Django admin restricted
- **Code:** `backend/config/settings.py`, `backend/config/urls.py`, `backend/docker-compose.yml`
- **Tests:** `backend/platform_core/tests/test_authorization.py`
- Off unless `DJANGO_ADMIN_ENABLED` (default: development only), at `DJANGO_ADMIN_PATH` outside `/api/`, staff accounts only (D-043).

## Exit criteria

- [x] Every endpoint is covered by the permission matrix (enforced by a test).
- [x] 100% of sign-in, sign-out, failed sign-in, context switch and invitation events are audited.
- [x] Audit rows cannot be updated or deleted (proved by tests against the database).
- [x] Club C gets nothing on any path.

## Frontend unlocked

None new, as planned. The app now shows the catalogue's role names and receives the active role's permissions (`hasPermission()`), ready for P5's actions.

## Acceptance evidence

- 2026-11-26 backend `scripts/ci.sh` (with image build and Trivy scan): ruff, mypy (191 files), Django checks incl. platform_core.E001/E002, tracker, event catalogue, migrations, OpenAPI zero warnings and matching, **307 tests OK** (2 skipped), **96% coverage**, `pip-audit` clean, image scan clean.
- 2026-11-26 frontend `scripts/ci.sh`: lint, type check, build, 0 npm vulnerabilities, image scan clean.
- 2026-11-26 browser tests: **172 passed, 14 skipped, 0 failed**.
- 2026-11-26 Docker stack check (nginx → API → PostgreSQL 16, plus the worker container): **28/28**.
- P3 specifics: 12 actors × every API endpoint (`test_permission_matrix.py`); audit UPDATE/DELETE refused by the database (tests and on the live stack); no email in any audit row; Django admin answers 404 when disabled; the session lists the role's permissions.

## Progress log

- 2026-11-26 · P3.1–P3.9 · PR #5 · permission engine, role catalogue, audit trail, deny-by-default check, permission matrix, admin restriction.
- 2026-11-26 · P3.1, P3.7 · PR #5 · schema corrections (D-046): database CHECK constraints for values and states, redundant indexes removed, housekeeping scheduled.
