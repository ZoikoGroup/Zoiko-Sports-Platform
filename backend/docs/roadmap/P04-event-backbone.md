# P4 — Event backbone

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P4 | ✅ Done | B | P1 | D-040, D-041, D-044 | Recent Updates; reliable side effects for P5–P12 |

**Objective:** reliable side effects. "Approved but nobody was told" and "told twice" must be impossible.

**Layer:** L3. **Track:** platform (B). Built together with P3 (one command, "Implement P3 & P4").

**Entry criteria:** P1 done. ✅

**Company decisions:** none.

**Source requirements:** GAP §09 (outbox, retries, dead letter), HO §08 event envelope, ARCH enqueue target (under 2 s for 95% of events).

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P4.1 | Transactional outbox: a change and its event saved in one transaction | ✅ Done | B | P1 | PR #5 |
| P4.2 | Background worker (PostgreSQL-backed) with retries, backoff, dead letters | ✅ Done | B | P4.1 | PR #5 |
| P4.3 | Event registry and versioning rules; duplicate- and order-tolerant consumers | ✅ Done | B | P4.1 | PR #5 |
| P4.5 | Operations tooling: replay dead letters, measure outbox lag | ✅ Done | B | P4.2 | PR #5 |
| P4.4 | Activity feed: readable, permission-scoped entries from events | ✅ Done | B | P4.3, P3.3 | PR #5 |

### P4.1 Transactional outbox
- **Code:** `backend/outbox/models.py`, `backend/outbox/services.py`, `backend/organizations/services.py`
- **Tests:** `backend/outbox/tests/test_outbox.py`
- `publish()` validates the payload against its contract and creates the event plus one delivery per subscribed consumer in the caller's transaction. The organizations module publishes six event types.

### P4.2 Background worker
- **Code:** `backend/outbox/worker.py`, `backend/outbox/management/commands/outbox.py`, `backend/docker-compose.yml`, `backend/docker-entrypoint.sh`
- **Tests:** `backend/outbox/tests/test_outbox.py`
- Our own PostgreSQL-backed loop (D-040): SKIP LOCKED claims, consumer and "done" in one transaction, exponential backoff, dead after `OUTBOX_MAX_ATTEMPTS`, graceful stop, heartbeat-based container health.

### P4.3 Event registry and versioning
- **Code:** `backend/platform_core/events.py`, `backend/organizations/events.py`, `backend/platform_core/management/commands/event_catalogue.py`, `backend/docs/contracts/events.md`, `backend/platform_core/boundaries.py`
- **Tests:** `backend/outbox/tests/test_outbox.py`, `backend/platform_core/tests/test_authorization.py`
- Rules in D-041; the catalogue is generated and checked in CI; `events` is part of a module's public interface.

### P4.5 Operations tooling
- **Code:** `backend/outbox/management/commands/outbox.py`, `backend/outbox/selectors.py`
- **Tests:** `backend/outbox/tests/test_outbox.py`
- `outbox status` (queue, dead letters by consumer, lag p50/p95), `replay`, `backfill`, `purge`; every delivery logs its lag.

### P4.4 Activity feed
- **Code:** `backend/activity/`, `backend/accounts/selectors.py`, `backend/organizations/selectors.py`
- **Tests:** `backend/activity/tests/test_activity.py`, `backend/access/tests/test_permission_matrix.py`
- `GET /api/v1/activity/` (needs `activity.view`, D-044). Entries copy the event's organization scope; `event_id` is unique, so replays never duplicate.

## Exit criteria

- [x] After an injected worker crash, each event takes effect exactly once (`ExactlyOnceTests`).
- [x] Outbox-to-consumer lag under 2 seconds for 95% of events (measured by a test with a live worker loop).
- [x] Activity entries are never visible to uninvited organizations.
- [x] Dead letters are visible (`outbox status`) and replayable (`outbox replay`).

## Frontend unlocked

None yet, as planned: the "Recent Updates" cards connect through the screen endpoints from P5 (`activity.selectors.latest_for`).

## Acceptance evidence

- 2026-11-26 backend `scripts/ci.sh` (with image build and Trivy scan): ruff, mypy (191 files), Django checks incl. platform_core.E001/E002, tracker, event catalogue, migrations, OpenAPI zero warnings and matching, **307 tests OK** (2 skipped), **96% coverage**, `pip-audit` clean, image scan clean.
- 2026-11-26 frontend `scripts/ci.sh`: lint, type check, build, 0 npm vulnerabilities, image scan clean.
- 2026-11-26 browser tests: **172 passed, 14 skipped, 0 failed**.
- 2026-11-26 Docker stack check (nginx → API → PostgreSQL 16, plus the worker container): **28/28**.
- P4 specifics: injected-crash and four-parallel-worker tests prove exactly-once effects; delivery lag p95 under 2 s with a live worker loop (test); on the live stack an accepted invitation appeared in the feed after **519 ms**, worker log lines carry the change's request ID, SIGTERM stops the worker cleanly. (`outbox status` there showed p50 ≈ 12 s only for the demo seed's backlog, published before the worker container started.)

## Progress log

- 2026-11-26 · P4.1–P4.5 · PR #5 · outbox, worker, event registry and catalogue, operations commands, activity feed.
- 2026-11-26 · P4.1, P4.5 · PR #5 · schema corrections (D-046): database CHECK constraints for values and states, redundant indexes removed, housekeeping scheduled.
