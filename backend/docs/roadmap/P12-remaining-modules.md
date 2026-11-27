# P12 — Remaining Phase 1 modules

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P12 | 🔄 In progress | A + B | P11 (or earlier on staging) | One per module | Remaining sidebar pages and workspaces |

**Objective:** the rest of Phase 1. Each module plugs into the existing engines (permissions, events, work items, notifications) without restructuring them.

**Layer:** L6. **One module per pull-request series**: each needs its own decisions.

**Entry criteria:** P11 done, or earlier on staging, plus the module's own decision. D-035 proposes P12.1 and P12.2 right after P8, because the pilot's golden event depends on them.

## Work packages (modules)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P12.1 | Venue readiness: checklists, evidence records, update requests, Venues & Readiness page | 👀 In review | A | P5, P8 (built ahead on D-047) | PR #7 |
| P12.2 | Event-day exceptions | ⬜ Pending | A | P5, P8 | |
| P12.3 | Participating Organizations and Team & Access (self-service invitations) | ⬜ Pending | A | P3, P5 | |
| P12.4 | Reports and audit exports | ⬜ Pending | B | P3.7, P9 | |
| P12.5 | Venue and Club & Team workspaces | ⬜ Pending | A | P5–P8 | |
| P12.6 | Internal Administration (staff console) | ⬜ Pending | A | P3 | |
| P12.7 | Settings (B), Documents (A) and Help (B) | ⬜ Pending | A + B | P3; Documents needs P12.8 storage | |
| P12.8 | Evidence files: upload, storage and malware scanning | ⬜ Pending | A | P12.1, GI3 | |

### P12.1 Venue readiness
- **Code:** `backend/readiness/`, `backend/workspaces/organizer/venues.py`, `backend/competitions/`, `backend/activity/services.py`, `backend/accounts/management/demo_readiness.py`, `frontend/src/features/organizer/venues/VenuesPage.tsx`, `frontend/src/features/organizer/api/organizerApi.ts`
- **Tests:** `backend/readiness/tests/test_readiness.py`, `backend/workspaces/tests/test_module.py`, `backend/competitions/tests/test_competitions.py`, `backend/access/tests/test_permission_matrix.py`, `frontend/e2e/organizer/venues.spec.ts`
- Built ahead of P5 and P8 on the defaults of D-047 (venue = organization, 4 check states, evidence as records).
- `GET /api/v1/organizer/venues/` (screen endpoint, `readiness.view`): summary, queue, needs attention, today's activity, regions, from one scoped read of **shared** checks only.
- `POST /api/v1/venue-readiness/{id}/update-requests/` (`readiness.request_update`, idempotent): the venue sees it in its activity feed (notifications: P7).
- Golden fixture: Northfield Arena's 16 checks, 14 shared; the organizer sees and counts only the 14.
- Still to come: the Action Centre's venue items (P8) and the venue's own workspace (P12.5).

### P12.8 Evidence files
- Decisions: storage and malware-scanning vendor (GI3), file limits.
- Adds file upload to `readiness.services.submit_evidence`; the evidence record already exists (P12.1).

### P12.2 Event-day exceptions
- Decisions: exception states and severity scale (K6, GB4), escalation and contact directory.
- Fills: Operational Alerts; the Event-Day Coordination page. Golden scenario: the turnstile incident.

### P12.3 Participating Organizations and Team & Access
- Decisions: the role catalogue (GP1), delegation (GP2), bulk import rules.
- Also delivers the self-service invitation API deferred from P2 (P2.7, D-032).
- The first API that edits organizations and memberships: give those tables a `version` column (VersionedModel, 409 on stale edits), as the schema audit noted (D-046).

### P12.4 Reports and audit exports
- Decisions: export formats, retention (D09); export jobs run in the worker (P4).

### P12.5 Venue and Club & Team workspaces
- Decision: which fields venues and clubs may see (GP3; K7: the two permission matrices disagree).
- Fills the workspace switcher's other workspaces (today they open a placeholder page).

### P12.6 Internal Administration
- Decision: break-glass access procedure (D12). Replaces the operator command (`manage.py organizations`) for verifying and suspending organizations.

### P12.7 Settings, Documents and Help
- Decision: scope definitions (setting keys, user versus organization scope). Sports Hub and Media & Content have no specification (K2) and stay disabled.

## Exit criteria

Each module defines its own when it starts; every module must pass the permission matrix (P3.8) and the golden-event tests.

## Acceptance evidence

(One block per module when accepted.)

### P12.1 Venue readiness (in review)

- 2026-11-27 backend `scripts/ci.sh` (with image build and Trivy scan): ruff, mypy, Django checks, tracker, event catalogue, migrations, OpenAPI zero warnings and matching, **359 tests OK** (2 skipped), **96% coverage**, `pip-audit` clean, image scan clean.
- 2026-11-27 frontend `scripts/ci.sh`: lint, type check, build, 0 npm vulnerabilities, image scan clean.
- 2026-11-27 browser tests: **196 passed, 14 skipped, 0 failed** (Venues & Readiness on live data on desktop, tablet and mobile).
- 2026-11-27 local Docker stack (nginx → API → PostgreSQL 16 → worker): migrations and seed applied to an existing database; the screen endpoint answered 200 (median 128 ms over 10 reads); Northfield showed 14 of 16 checks; an update request returned 201, its retry with the same key was replayed, and the line reached Northfield's activity feed through the worker; the venue manager got 403 on the organizer screen.

## Progress log

(One line per merged pull request.)

- 2026-11-27 · P12.1 · PR #7 (in review) · venue readiness module, screen endpoint, update requests; Venues & Readiness page connected (D-047).
