# MODULE_NAME

<!-- Replace MODULE_NAME and every "…" below. CI (check_tracker) requires this file. -->

**Purpose:** …
**Built in:** P… ([roadmap](../docs/roadmap/)). **Owner:** Developer …

## Models

| Model | Notes |
|---|---|
| … | Key fields, constraints, status values |

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.…` | write | … |
| `selectors.…` | read | … |

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/…` | … (one request/response example; full shape in `openapi.yaml`) |

## Events, permissions, audit

- **Events published** (`events.py`): `name.v1`, with payload fields. Consumers: …
- **Events consumed:** …
- **Permissions** (`policies.py`): action codes and who holds them.
- **Audit:** which writes are audited.

## Tests

| File | Covers |
|---|---|
| `tests/…` | … |

## Known gaps

- …
