# platform_core

**Purpose:** the platform kernel: conventions every module reuses, implemented once. No
business rules and no business tables (only idempotency records).
**Built in:** P0 and P1 ([P0](../docs/roadmap/P00-foundation.md), [P1](../docs/roadmap/P01-kernel.md)), plus the hooks P3 and P4 plug into.
**Owner:** shared; both developers review every change and announce one before starting it.

The rules themselves are in [conventions.md](../docs/conventions.md); this file says where each
piece lives.

| File | What it provides |
|---|---|
| `models.py` | `PlatformModel` (UUID `public_id`, timestamps), `VersionedModel`, `IdempotencyRecord` |
| `errors.py` | The JSON error envelope and `ApiError`; `ERROR_CODES` |
| `request_context.py`, `middleware.py`, `logging.py` | Correlation ID per request; health probes before host checks; JSON logs |
| `concurrency.py` | `update_versioned()`: 409 `version_conflict` |
| `idempotency.py` | `@idempotent` for creates (`Idempotency-Key`) |
| `pagination.py`, `filtering.py` | `CursorPage` keyset pagination; strict filter parameters |
| `timeutils.py`, `fields.py` | UTC, IANA zones, daylight-saving-safe conversion; serializer fields |
| `workspace.py` | `WorkspaceContext`, `HasWorkspaceContext` (403 `context_required`) |
| `authorization.py` | `RequirePermission`, `Public`, `allowed_actions`, `deny` (404/403), `public_endpoint`; the `access` engine plugs in here (P3) |
| `events.py` | `EventType` contracts and their registry (P4, D-041) |
| `openapi.py` | Shared OpenAPI pieces (error responses, `Idempotency-Key` header) |
| `boundaries.py`, `checks.py` | The module boundary rule (E001) and deny-by-default endpoints (E002) as `manage.py check` system checks |
| `tracker.py` | Parses and validates the tracker in `backend/docs` |
| `maintenance.py` | Housekeeping registry: modules register clean-up tasks; the worker runs them on a schedule |
| `health.py`, `urls.py` | `/api/v1/health/live/`, `/api/v1/health/ready/` |
| `app_template/` | Template for new modules (`startapp --template=platform_core/app_template`) |

## Management commands

| Command | Purpose |
|---|---|
| `wait_for_db` | Waits for PostgreSQL before migrations (Docker entrypoint, CI) |
| `purge_idempotency_records` | Deletes expired idempotency records |
| `maintenance` (`--list`) | Runs the housekeeping now: expired sessions, idempotency records, old delivered events |
| `check_tracker` (`--write`) | Validates `backend/docs`; `--write` regenerates `ROADMAP.md` and the decision index |
| `check_pull_request` | The pull-request tracker rule (D-038), as GitHub's `tracker` job runs it |
| `event_catalogue` (`--write`) | Checks or rewrites `backend/docs/contracts/events.md` from the declared event types |

## Tests

`tests/test_*.py`, one file per convention. `tests/reference/` is a test-only module that uses
every convention through real HTTP calls: copy its shape when building a module.

## Known gaps

- `ETag`/`If-Match` headers: with the first editable resource (D-015).
