# P5 — Competitions and event participation

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P5 | 🔄 In progress | A | P3, P4 | GD3, K3 and 4 more | Competitions & Events page |

**Objective:** competitions, events and the second security gate, "an organization does not equal an event".

**Layer:** L4. **Track:** domain (A).

**Entry criteria:** P3 and P4 merged.

**Company decisions needed before starting:**
- How competitions, events and fixtures relate (GD3).
- Competition and event lifecycle states (K3: the documents disagree).
- Whether the create-competition form collects city and time zone.
- Whether a venue is an organization or free text.
- The sports reference list ("football" versus "soccer").
- What "active competition" means for the KPI.

**Source requirements:** FSD §12 lifecycles, HO §08 `POST /v1/events`, FSD T04, T05, T07, T08.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P5.1 | Reference data: sports, countries, regions, time zones | ⬜ Pending | A | P3 | |
| P5.2 | Competition, event and event-participation tables | 🔄 In progress | A | P5.1 | PR #7 (subset) |
| P5.3 | Lifecycle transitions defined as data (allowed from/to pairs) | ⬜ Pending | A | P5.2 | |
| P5.4 | Services: create competition, create event, invite/accept/revoke participation | ⬜ Pending | A | P5.3, P4 | |
| P5.5 | Event participation added to the policy engine as the second gate | ⬜ Pending | A | P5.2, P3.2 | |
| P5.6 | Read endpoints with server-side filters and cursor pagination | ⬜ Pending | A | P5.5 | |
| P5.7 | Competitions & Events screen endpoint, shaped like the frontend view model | ⬜ Pending | A | P5.6 | |

### P5.1 Reference data
- Planned code: new module `backend/reference/`. Replaces the hard-coded lists in `frontend/src/features/organizer/` over time.

### P5.2 Tables
- Planned code: new module `backend/competitions/`: `Competition` (owner organization, sport, country, dates, IANA zone, status, version), `Event`, `EventParticipation` (invited, accepted, revoked).
- Indexes: (owner organization, status), (competition, start).
- **Started for P12.1 (D-047):** `Competition` (organizer, name, sport, status, version) and `Event` (venue organization, city, country, region, IANA zone, start, status, version) exist in `backend/competitions/`, with `create_competition` / `schedule_event` services, audit entries and events. Still to do: `EventParticipation`, competition dates and country, and replacing the D-047 defaults with GD3/K3 once decided.

### P5.3 Lifecycle as data
- One table of allowed transitions; services refuse anything else with a clear error code.

### P5.4 Services
- Each write is idempotent (`platform_core.idempotency`), version-checked (`platform_core.concurrency`), audited (P3.7) and emits an event (P4.1).
- First editable resource: add `ETag`/`If-Match` support here (D-015).

### P5.5 Participation as the second gate
- An organization without accepted participation gets 404 on the event and everything below it.

### P5.6 Read endpoints
- `GET/POST /api/v1/competitions/`, `GET /api/v1/competitions/{id}/`, `POST /api/v1/competitions/{id}/events/`, participation endpoints. Filters: search, sport, region, status.

### P5.7 Screen endpoint
- `GET /api/v1/organizer/competitions/`, one permission-filtered call that fills the page. Planned location: `backend/workspaces/organizer/competitions.py` (one file per screen).
- Connect the page: set the entries in `frontend/src/features/organizer/api/endpoints.ts` (`competitions`, `createCompetition`, `createEvent`) and map fields in `organizerApi.ts`.

## Exit criteria

- [ ] FSD T04, T05, T07 and T08 pass.
- [ ] A double-submitted create produces exactly one record.
- [ ] Club C gets 404 on every path.
- [ ] Directory responds in under 300 ms for 95% of requests at pilot volume (assumption: 500 competitions and 5,000 events per organization), with a constant query count.
- [ ] The Competitions & Events page renders entirely from the API.

## Frontend unlocked

- Competitions & Events: directory, details drawer, create competition, create event, planning summary.
- Overview: Upcoming Events.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
