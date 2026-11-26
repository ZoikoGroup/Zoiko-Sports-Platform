# outbox

**Purpose:** the event backbone: events are saved in the same transaction as the change they
describe, and a worker delivers each one to every subscribed consumer exactly once.
**Built in:** P4 ([roadmap](../docs/roadmap/P04-event-backbone.md)). **Owner:** Developer B.

## Models

| Model | Notes |
|---|---|
| `OutboxEvent` | `event_id` (UUID), `type` + `version`, aggregate (type, ID, version), `organization_id` (visibility scope), `payload`, `occurred_at`, `request_id` |
| `Delivery` | One per (event, consumer): `status` pending / done / dead, `attempts`, `available_at`, `last_error`, `delivered_at` |

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.publish(event_type, payload, aggregate=(type, id), organization_id=…)` | write | Store an event + its deliveries in the caller's transaction (payload checked against the contract) |
| `services.subscribe(name, event_types, handler)` | write | Register a consumer at start-up (its `AppConfig.ready`) |
| `services.replay(…)`, `backfill(consumer)`, `purge(older_than=…)` | write | Operations (dead letters, late consumers, retention) |
| `selectors.stats()` | read | Queue sizes, dead letters by consumer, delivery lag p50/p95 |

Event types are declared in each publishing module's `events.py` (contracts in
`platform_core/events.py`, catalogue in [contracts/events.md](../docs/contracts/events.md)).

## The worker

`python manage.py outbox worker` (the `worker` service in `docker-compose.yml`). It claims one due
delivery at a time with `SELECT … FOR UPDATE SKIP LOCKED`, runs the consumer in a savepoint and
marks it done in the same transaction: a crash rolls both back, so each effect happens exactly
once. Failures retry after 2, 4, 8 … seconds (capped) and become `dead` after
`OUTBOX_MAX_ATTEMPTS`. A PostgreSQL-backed worker of our own, not Procrastinate (D-040).

## Operator command

`outbox worker [--once]`, `outbox status`, `outbox replay [--consumer …] [--event …] [--include-done]`,
`outbox backfill <consumer> [--since …]`, `outbox purge --older-than-days N`.

## Events, permissions, audit

- **Audit:** `outbox.replayed`.
- No endpoints: operators use the command.

## Tests

`tests/test_outbox.py`: contracts, same-transaction publishing, retries and backoff, dead letters,
missing consumers, replay / backfill / purge, stats, the loop and heartbeat, the command; plus an
injected crash (exactly once), four parallel workers (each delivery once), and delivery lag p95
under 2 seconds.

## Known gaps

- Lag and dead-letter alerts need the monitoring stack (P11.4); today `outbox status` and the
  worker's logs show them.
