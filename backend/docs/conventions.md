# Platform conventions

Every module follows these rules; `backend/platform_core` implements each one once (P1).
Module layout and the boundary rule are in [architecture.md](architecture.md).

| Convention | Rule | Where |
| --- | --- | --- |
| Errors | `{"error": {"code", "message", "request_id", "fields"?}}` for every API error, including unknown URLs, CSRF failures, rejected hosts and unexpected server errors (no HTML, no stack traces). Codes are listed in `ERROR_CODES` | `errors.py` |
| Correlation ID | Every response carries `X-Request-ID` (nginx's `$request_id`, else generated); the same ID is in the error body and in every log line of the request, including gunicorn's access line (D-020) | `request_context.py`, `middleware.py`, `logging.py` |
| Records | Records exposed through the API have a random UUID `public_id`, used as `"id"` in URLs and responses (integer keys stay internal), plus `created_at` / `updated_at` (D-018) | `models.py` (`PlatformModel`) |
| Versioned edits | Editable records carry `version` (starts at 1). An edit states the version it was based on; if the stored version moved on, the answer is `409 version_conflict` with `current_version`. The check and the change are one SQL statement, so of two simultaneous edits exactly one succeeds (D-015) | `models.py` (`VersionedModel`), `concurrency.py` |
| Idempotent creates | Creates require an `Idempotency-Key` header (a new UUID per submission). A retry with the same key returns the original response with `Idempotent-Replayed: true`; the same key with a different body is `422 idempotency_key_reused`; a duplicate arriving while the first is still running is `409 request_in_progress`. Keys belong to one user and expire after `IDEMPOTENCY_TTL_HOURS` (D-014) | `idempotency.py` |
| Lists | Cursor pages: `?page_size=&cursor=` → `{"next", "previous", "results"}`; newest first by default; page size capped at `API_MAX_PAGE_SIZE`; a bad cursor is `400 invalid_cursor` (D-016) | `pagination.py` |
| Filters | Declared per list as a serializer; `q` is free-text search; unknown or repeated parameters are `400 validation_error` | `filtering.py` |
| Time | Instants in RFC 3339 with an offset, stored and returned in UTC (`…Z`); a time without an offset is rejected. Time zones are canonical IANA names (`Europe/London`; not `EST` or `US/Eastern`). Local times that don't exist (clocks forward) or happen twice (clocks back) are rejected unless the caller picks a side (D-017) | `timeutils.py`, `fields.py` |
| Workspace context | Every request acts for one verified context (an organization membership or the Individual workspace), re-checked on every request by `accounts.middleware`. Module views that act for an organization use `permission_classes = [IsAuthenticated, HasWorkspaceContext]` and scope queries with `request.workspace_context.organization_id`; without a context the answer is `403 context_required` | `workspace.py` |
| Modules | New modules start from `python manage.py startapp <name> --template=platform_core/app_template` (layout: `README.md`, `api/`, `services.py`, `selectors.py`, `policies.py`, `events.py`, `models.py`, `tests/`). Modules may use each other only through `services` and `selectors`; `manage.py check` (and so CI) fails on any other cross-module import | `app_template/`, `boundaries.py` |
| API contract | The generated `backend/openapi.yaml` is the contract. After an intentional API change, review the difference and run `python manage.py spectacular --file openapi.yaml`. Never hand-merge this file: after a rebase, regenerate it (D-019) | `openapi.py` |
| Tracker | Work-package status, decisions and module READMEs are checked by `python manage.py check_tracker` in CI (D-022) | `tracker.py` |

`platform_core/tests/reference/` is a test-only module (installed only under `manage.py test`)
that uses every convention through real HTTP calls; copy its shape when building a module.

Expired idempotency records are removed whenever their user stores a new one;
`python manage.py purge_idempotency_records` removes all of them and can run on a schedule.

## Database migrations

- Each module's migrations have one owner at a time (the phase file's owner).
- Never edit or renumber a migration that is on `main`.
- If your unmerged branch and `main` both added migrations to the same module: rebase, delete
  your unmerged migration and run `makemigrations` again. Don't create `--merge` migrations.
- A change to a table other code already uses happens in three steps: add the new column, fill
  it, then remove the old one in a later pull request. P2 moved tables this way
  (`accounts/migrations/0003_move_organizations.py`).
- Every schema change of existing data gets an upgrade test from the previous schema, like
  `organizations/tests/test_migrations.py`. CI checks that the migrations match the models.
