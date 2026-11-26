# D-040 — The outbox worker is our own PostgreSQL-backed loop

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P4 |
| Company reference | — |

## Context

The plan recommended a PostgreSQL-backed queue (Procrastinate) and asked to confirm the choice when P4 started.

## Decision

A small worker of our own over the outbox tables: claim with SELECT … FOR UPDATE SKIP LOCKED, run the consumer in a savepoint and mark the delivery done in the same transaction. No new dependency or extra tables, exactly-once effects per consumer, several workers can run side by side. Move to a broker only if measured volume requires it.

## Consequences

`backend/outbox/worker.py`; the `worker` service in `backend/docker-compose.yml`.
