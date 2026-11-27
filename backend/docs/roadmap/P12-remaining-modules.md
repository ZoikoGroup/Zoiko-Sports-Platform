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
| P12.1 | Venue readiness: checklists, evidence records, update requests, Venues & Readiness page | ✅ Done | A | P5, P8 (built ahead on D-047) | PR #7 |
| P12.2 | Event-day exceptions | ⬜ Pending | A | P5, P8 | |
| P12.3 | Participating Organizations and Team & Access (self-service invitations) | ⬜ Pending | A | P3, P5 | |
| P12.4 | Reports and audit exports | ⬜ Pending | B | P3.7, P9 | |
| P12.5 | Venue and Club & Team workspaces | ⬜ Pending | A | P5–P8 | |
| P12.6 | Internal Administration (staff console) | ⬜ Pending | A | P3 | |
| P12.7 | Settings (B), Documents (A) and Help (B) | ⬜ Pending | A + B | P3; Documents needs P12.8 storage | |
| P12.8 | Evidence files: upload, storage and malware scanning | ⬜ Pending | A | P12.1, GI3 | |
| P12.9 | Readiness queue hygiene: finished events leave the queue; rate limit on update requests | ⬜ Pending | A | P12.1; past-event window decision | |
| P12.10 | Organizer reviews readiness checks (accept / request changes) from the page | ⬜ Pending | A | P12.1 | |
| P12.11 | Venue access to its own readiness and to the organizer's update requests | ⬜ Pending | A | P12.1 | |
| P12.12 | Readiness checklist set-up for an event's venue | ⬜ Pending | A | P12.1, P5.4; checklist template decision | |
| P12.13 | Readiness detail endpoint and a capped queue (scale) | ⬜ Pending | A | P12.1 | |
| P12.14 | Overdue readiness checks publish an event (Action Centre, notifications) | ⬜ Pending | A | P12.1, P8.1 | |

P12.9–P12.14 are what the Venues & Readiness page still needs from the backend (audit of
2026-11-27, against `main` `3ddf2b7`). The page's full status, element by element and layer by
layer, is under [P12.1](#p121-venue-readiness) below.

### P12.1 Venue readiness
- **Code:** `backend/readiness/`, `backend/workspaces/organizer/venues.py`, `backend/competitions/`, `backend/activity/services.py`, `backend/accounts/management/demo_readiness.py`, `frontend/src/features/organizer/venues/VenuesPage.tsx`, `frontend/src/features/organizer/api/organizerApi.ts`
- **Tests:** `backend/readiness/tests/test_readiness.py`, `backend/workspaces/tests/test_module.py`, `backend/competitions/tests/test_competitions.py`, `backend/access/tests/test_permission_matrix.py`, `frontend/e2e/organizer/venues.spec.ts`
- Built ahead of P5 and P8 on the defaults of D-047 (venue = organization, 4 check states, evidence as records).
- `GET /api/v1/organizer/venues/` (screen endpoint, `readiness.view`): summary, queue, needs attention, today's activity, regions, from one scoped read of **shared** checks only.
- `POST /api/v1/venue-readiness/{id}/update-requests/` (`readiness.request_update`, idempotent): the venue sees it in its activity feed (notifications: P7).
- Golden fixture: Northfield Arena's 16 checks, 14 shared; the organizer sees and counts only the 14.

**What P12.1 delivers and what it does not** (audit of 2026-11-27 against `main` `3ddf2b7`).
Legend: ✅ implemented · 🟡 partial · ⬜ pending (with the work package that delivers it).

How the page gets its data:

```
/organizer/venues (VenuesPage.tsx)
  → organizerApi.venues() → GET /api/v1/organizer/venues/        (endpoints.ts: venues)
      workspaces/organizer/venues.py  VenuesScreenView  (readiness.view)
        → readiness.selectors.board(context)
            visible_readiness(): scope_to_context(owner = event → competition → organizer)
            shared checks only, evidence counted per check, statuses computed at read time
  ← venuesMapping.ts maps snake_case → the page's view model (types.ts)
"Request an update" → POST /api/v1/venue-readiness/{id}/update-requests/ + Idempotency-Key
      readiness/api/views.py  UpdateRequestCreateView  (readiness.request_update, @idempotent)
        → readiness.services.request_update(): row + audit entry + outbox event, one transaction
        → worker → activity.feed consumer → a line in the venue's activity feed
```

Page elements:

| Page element | Status | Backend behind it |
|---|---|---|
| Summary cards, tab counts | ✅ | `summary` from `board()`; totals equal the queue's rows |
| Competition / region / status filters | ✅ | Values from each row (`competition_id`, `region`, `status`); filtering is in the browser |
| Readiness queue (all columns) | ✅ | `venues[]`: one row per venue and event, soonest event first |
| ⋯ View readiness, details panel | ✅ | `check_list` (shared checks only), `issue`, facts |
| ⋯ Request an update | 🟡 | Saved, audited, reaches the venue's feed; the venue cannot read the message (⬜ P12.11) |
| Needs Attention | ✅ | `attention[]`: changes requested, or open past due; critical = high |
| Today's Venue Activity | ✅ | `activity[]`: reviews, submissions and due dates today in each event's time zone |
| Regional Readiness Snapshot | ✅ | `regions[]`: ready / total per region |
| "Review Readiness" button | 🟡 | Filters to Pending Review; reviewing itself is ⬜ P12.10 |
| Evidence files in the details | ⬜ | Records only today (P12.8, GI3) |
| "Venue Calendar", "View calendar", "Fixtures & Schedule" links | ⬜ | Open Fixtures & Schedule, whose backend is P6 (`endpoints.ts`: `fixtures: null`) |
| "View by region" link | ⬜ | Opens the Reports placeholder (`/organizer/reports`), P12.4 |
| Readiness Framework, hero | — | Fixed content; no backend |

Backend layers:

| Layer | ✅ Implemented | 🟡 Partial | ⬜ Pending |
|---|---|---|---|
| API | `GET /api/v1/organizer/venues/`; `POST /api/v1/venue-readiness/{id}/update-requests/` (both in `openapi.yaml`) | — | Review (P12.10); venue reads (P12.11); checklist set-up (P12.12); detail endpoint (P12.13); evidence upload (P12.5, P12.8); create competitions and events (P5.4, P5.6) |
| Models and migrations | `readiness` 0001 (`VenueReadiness`, `ReadinessCheck`, `ReadinessEvidence`, `UpdateRequest`, CHECK constraints for states and times), 0002 (permissions) | `competitions` 0001 (`Competition`, `Event`): the P5.2 subset only | Checklist templates (P12.12); `EventParticipation` (P5.2) |
| Business logic | Statuses, severity, overdue, today in the event's zone, shared-only reads (`readiness/selectors.py`); state rules with row locks (`readiness/services.py`) | Queue scoping drops only cancelled events (P12.9) | Overdue publishes no event (P12.14) |
| Workflows | Organizer views readiness; organizer asks for an update | Update request: delivered to the feed, message unreadable (P12.11) | Organizer review (P12.10); venue submits (P12.5); checklist set-up (P12.12) |
| Permissions | `readiness.view`, `readiness.request_update` (competition director, organizer coordinator; `readiness/migrations/0002_permissions.py`); both routes in the permission matrix | — | `readiness.review` (P12.10); venue-side permissions and visibility (P12.11) |
| Security | Scoped reads (404 for other organizers), 403 without permission, private checks never read for the organizer, audit of every write, no free text in audit or events, idempotent create | — | Rate limit on update requests (P12.9) |
| Real-time | Update requests and reviews reach the venue's activity feed through the outbox worker | — | Live page refresh (P10); notifications (P7); Action Centre items (P8, needs P12.14) |
| Testing | `readiness/tests/test_readiness.py` (19 tests), `workspaces/tests/test_module.py` (3), `competitions/tests/test_competitions.py` (7), permission matrix, seed test in `accounts/tests.py`, `frontend/e2e/organizer/venues.spec.ts` (8 tests × 3 viewports) | — | Feed wording for reviews (P12.10); the page's error state in the browser (P12.9); load test at 500 venue-event pairs (P12.13) |

Where to continue (dependency order; each step needs only those above it):

1. **P12.9** queue hygiene and rate limit: needs only the past-event window decision.
2. **P12.10** organizer review: no decision needed; the service exists.
3. **P12.11** venue access and update-request reads: no decision needed for the narrow rule.
4. **P12.12** checklist set-up: needs the checklist template decision and P5.4.
5. **P12.13** detail endpoint and cap: before onboarding many venues.
6. **P12.14** overdue event: at the start of P8. Then P12.5 (venue workspace) and P12.8 (files).

How to verify the page end to end: `python manage.py test readiness workspaces competitions
access.tests.test_permission_matrix` (from `backend/`); `npx playwright test e2e/organizer/venues.spec.ts`
(from `frontend/`); on the Docker stack with `ZS_SEED_DEMO=true`, sign in as
`organizer@zoikosports.test` and open `/organizer/venues` (5 demo venues: 2 ready, 2 pending
review, 1 needing attention).

### P12.8 Evidence files
- Decisions: storage and malware-scanning vendor (GI3), file limits.
- Adds file upload to `readiness.services.submit_evidence`; the evidence record already exists (P12.1).
- **Accepted when:** a venue uploads a file for a check; it is scanned before anyone can download
  it; an infected or oversized file is refused with a clear error; the organizer downloads only
  files of shared checks; downloads are audited.

### P12.9 Readiness queue hygiene
- **Why:** `readiness/selectors.py` `visible_readiness()` excludes only cancelled *events*. Events
  of cancelled or completed competitions, completed events and events long past stay in the
  queue for ever; a past event with an open check stays under "Needs Attention". The
  update-request endpoint has no rate limit (`config/settings.py` throttles only `auth` and
  `invitation`; an `Idempotency-Key` stops duplicates of one submission, not repeated ones).
- **Decision needed:** how long an event stays in the queue after it starts (proposal: 24 hours).
  Record it as a decision file.
- **Code to change:** `readiness/selectors.py` (`visible_readiness`), `config/settings.py`
  (`DEFAULT_THROTTLE_RATES`, new `READINESS_REQUEST_THROTTLE_RATE`, passed through
  `docker-compose.yml`), `readiness/api/views.py` (`throttle_classes`).
- **Accepted when:**
  - [ ] Events of cancelled or completed competitions, completed events and events past the
        window are in no list, count, attention item, activity item or region total.
  - [ ] Summary totals still equal the queue's rows (existing tests stay green).
  - [ ] The request over the limit (default 20 per minute per person) answers 429 `rate_limited`;
        the page shows the server's message.
  - [ ] Browser test: the page shows its error state when the screen endpoint fails (untested today).

### P12.10 Organizer reviews readiness checks
- **Why:** the page's "Review Readiness" button only filters the queue. `review_check()` in
  `readiness/services.py` exists and is tested, but only the demo seed calls it: there is no
  endpoint, so an organizer cannot accept evidence or request changes.
- **Code to add:** `POST /api/v1/readiness-checks/{id}/review/` (`{"accepted": bool, "note"}`) in
  `readiness/api/`; permission `readiness.review` (data migration: competition director,
  organizer coordinator); its row in `access/tests/test_permission_matrix.py` (`MATRIX`,
  `HOLDERS`); the action in `frontend/src/features/organizer/venues/VenueDrawer.tsx` and its
  entry in `frontend/src/features/organizer/api/endpoints.ts`.
- **Accepted when:**
  - [ ] Only a **submitted, shared** check of the organizer's own event can be reviewed; a private
        check or another organizer's check answers 404; a check in another state 409
        `check_not_submitted`.
  - [ ] Requesting changes needs a note (1–300 characters); accepting clears it.
  - [ ] Audited (`readiness.check_reviewed`) and published; the venue's activity feed shows
        "… accepted …" / "… requested changes to …" (that wording in `activity/services.py` is
        untested today: add the test).
  - [ ] After a review the page refreshes; status, Needs Attention and today's activity agree.

### P12.11 Venue access to its own readiness
- **Why:** readiness is owned by the event's organizer (`VenueReadiness.owner_organization_id` in
  `readiness/models.py`), so the policy engine shows a venue nothing of its own readiness.
  `UpdateRequest` is written by `request_update()` and **read nowhere**: the venue's feed says a
  request arrived, but the venue cannot read what was asked.
- **Code to add:** a narrow visibility rule ("readiness where `venue` is my organization") in
  `readiness/selectors.py`, or the P5.5 participation gate with profile `venue` once it exists;
  `GET /api/v1/venue-readiness/` (the venue's list) and
  `GET /api/v1/venue-readiness/{id}/update-requests/`; permission `readiness.venue_view` for
  `venue_manager` and `venue_staff` (data migration).
- **Accepted when:**
  - [ ] A venue sees all of its own checks (shared and private) and the update requests about
        them, message included; nothing of other venues (404).
  - [ ] The organizer still sees only shared checks (existing tests stay green).
  - [ ] Club C and other venues get 404 on every path (golden-event rule).
- **Feeds:** P12.5 (the venue workspace builds on these endpoints, then exposes `submit_evidence`).

### P12.12 Readiness checklist set-up
- **Why:** `open_readiness()` is called only by the demo seed
  (`accounts/management/demo_readiness.py`). Outside the demo nothing gives an event's venue a
  checklist, so on a real database the page stays empty ("No venues share readiness with your
  events yet.").
- **Decision needed:** who defines a checklist (organizer template, venue, or both), the standard
  items, and whether the venue chooses what to share.
- **Depends on:** real events: P5.4 and P5.6 (create competitions and events through the API).
- **Accepted when:**
  - [ ] An authorised user sets up an event venue's checklist from a template through the API; a
        second set-up for the same event and venue returns the existing one (as
        `open_readiness()` does).
  - [ ] Template items, sharing and critical flags follow the decision; audited; publishes
        `readiness.opened`.

### P12.13 Readiness detail endpoint and a capped queue
- **Why:** the screen response carries every venue's full checklist: measured at about 1.9 KB per
  venue (9.7 KB for the 5 demo venues). At 500 venue-event pairs that is about 1 MB and 7,000
  checks per page load.
- **Code to change:** move `check_list` out of `workspaces/organizer/venues.py` into
  `GET /api/v1/venue-readiness/{id}/`; cap or paginate the queue; the details panel loads its
  checks when opened (`VenuesPage.tsx`, `VenueDrawer.tsx`, `venuesMapping.ts`). API contract
  change: regenerate `openapi.yaml` in the same pull request.
- **Accepted when:**
  - [ ] Screen response under 300 bytes per venue; 95% of reads under 300 ms with 500
        venue-event pairs, with a constant query count.
  - [ ] The details panel shows the same checks as today, with a loading state.

### P12.14 Overdue readiness checks publish an event
- **Why:** "overdue" is computed when the page is read (`_is_overdue()` in
  `readiness/selectors.py`); nothing is published when a check passes its due time, so the
  Action Centre (P8) and notifications (P7) cannot react.
- **Code to add:** a housekeeping task registered in `platform_core/maintenance.py` (the worker
  already runs these) that publishes `readiness.check_overdue` once per check and due time.
- **Accepted when:** each overdue check publishes exactly one event, even with several workers; a
  check submitted before its due time publishes none; the event appears in `contracts/events.md`.
- **When:** at the start of P8 (nothing consumes it before then).

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

**Venue readiness (P12.1)**

- 2026-11-27 backend `scripts/ci.sh` (with image build and Trivy scan): ruff, mypy, Django checks, tracker, event catalogue, migrations, OpenAPI zero warnings and matching, **359 tests OK** (2 skipped), **96% coverage**, `pip-audit` clean, image scan clean.
- 2026-11-27 frontend `scripts/ci.sh`: lint, type check, build, 0 npm vulnerabilities, image scan clean.
- 2026-11-27 browser tests: **196 passed, 14 skipped, 0 failed** (Venues & Readiness on live data on desktop, tablet and mobile).
- 2026-11-27 local Docker stack (nginx → API → PostgreSQL 16 → worker): migrations and seed applied to an existing database; the screen endpoint answered 200 (median 128 ms over 10 reads); Northfield showed 14 of 16 checks; an update request returned 201, its retry with the same key was replayed, and the line reached Northfield's activity feed through the worker; the venue manager got 403 on the organizer screen.

## Progress log

(One line per merged pull request.)

- 2026-11-27 · P12.1 · PR #7 · venue readiness module, screen endpoint, update requests; Venues & Readiness page connected (D-047).
