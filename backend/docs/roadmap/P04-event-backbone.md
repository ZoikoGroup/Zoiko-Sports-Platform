# P4 — Event backbone

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P4 | ⬜ Pending | B | P1 | — | Recent Updates; reliable side effects for P5–P12 |

**Objective:** reliable side effects. "Approved but nobody was told" and "told twice" must be impossible.

**Layer:** L3. **Track:** platform (B). **Runs in parallel with:** P3. P5 needs both.

**Entry criteria:** P1 done (met). The roadmap allows P4 to start before P2 and P3 finish.

**Company decisions:** none.

**Source requirements:** GAP §09 (outbox, retries, dead letter), HO §08 event envelope, ARCH enqueue target (under 2 s for 95% of events).

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P4.1 | Transactional outbox: a change and its event saved in one transaction | ⬜ Pending | B | P1 | |
| P4.2 | Background worker (PostgreSQL-backed) with retries, backoff, dead letters | ⬜ Pending | B | P4.1 | |
| P4.3 | Event registry and versioning rules; duplicate- and order-tolerant consumers | ⬜ Pending | B | P4.1 | |
| P4.5 | Operations tooling: replay dead letters, measure outbox lag | ⬜ Pending | B | P4.2 | |
| P4.4 | Activity feed: readable, permission-scoped entries from events | ⬜ Pending | B | P4.3, P3.3 | |

P4.4 is listed last on purpose: it needs P3's scoped queries.

### P4.1 Transactional outbox
- Planned code: new module `backend/outbox/` (`startapp --template=platform_core/app_template`).
- Each event carries ID, type, schema version, aggregate and version, organization, timestamps and correlation ID (`platform_core.request_context`).
- Acceptance: a rolled-back change leaves no event; a committed change always has exactly one.

### P4.2 Background worker
- Planned: a worker container in `backend/docker-compose.yml`. The plan recommends Procrastinate (a PostgreSQL-backed queue; no extra broker); confirm the choice in a decision file when P4 starts.
- Acceptance: after an injected worker crash, each event takes effect exactly once.

### P4.3 Event registry and versioning
- Each module publishes its events from its own `events.py` (already reserved by the module template): versioned name such as `fixture.schedule_published.v1` plus a typed payload. A breaking change ships as `v2` alongside `v1`.
- Generates `backend/docs/contracts/events.md` (the event catalogue).

### P4.5 Operations tooling
- A management command to replay dead-lettered events; outbox lag measured and logged.

### P4.4 Activity feed
- Planned code: new module `backend/activity/`.
- Entries copy their visibility scope from the source record, so uninvited organizations never see them. Kept separate from the restricted audit trail (P3.7).

## Exit criteria

- [ ] After an injected worker crash, each event takes effect exactly once.
- [ ] Outbox-to-consumer lag under 2 seconds for 95% of events.
- [ ] Activity entries are never visible to uninvited organizations.
- [ ] Dead letters are visible and replayable.

## Frontend unlocked

The "Recent Updates" sections (Overview, Competitions), once P5 starts producing events.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
