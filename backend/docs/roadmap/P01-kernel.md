# P1 — Platform kernel

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P1 | ✅ Done | A | P0 | D-014 to D-021 | The conventions every module reuses |

**Objective:** shared conventions every module reuses, so no module invents its own errors, IDs, paging or concurrency rules. No business tables, no frontend changes.

**Layer:** L1. Merged to `main` in PR #3 (`dbb8793`, 2026-11-24). Conventions are summarised in [conventions.md](../conventions.md).

## Work packages

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P1.1 | Base records: public UUID, timestamps, version | ✅ Done | A | P0 | PR #3 (f584668) |
| P1.2 | Error envelope with `request_id` | ✅ Done | A | P0 | PR #3 (f584668) |
| P1.3 | Request correlation ID through logs and errors | ✅ Done | A | P0 | PR #3 (f584668) |
| P1.4 | Cursor pagination and strict filters | ✅ Done | A | P1.1 | PR #3 (f584668) |
| P1.5 | Idempotent creates (`Idempotency-Key`) | ✅ Done | A | P1.2 | PR #3 (f584668) |
| P1.6 | Version-checked edits (409 `version_conflict`) | ✅ Done | A | P1.1 | PR #3 (f584668) |
| P1.7 | UTC storage, IANA time zones, daylight-saving rules | ✅ Done | A | P0 | PR #3 (f584668) |
| P1.8 | OpenAPI generated from code; CI diff against `openapi.yaml` | ✅ Done | A | P0 | PR #3 (bdadf3d) |
| P1.9 | Module template and module boundary rule | ✅ Done | A | P0 | PR #3 (f584668) |

### P1.1 Base records
- **Code:** `backend/platform_core/models.py`
- **Tests:** `backend/platform_core/tests/test_concurrency.py`
- `PlatformModel` gives `public_id` (UUID v4, used as `"id"` in the API), `created_at`, `updated_at`; `VersionedModel` adds `version`. Decision: D-018.

### P1.2 Error envelope
- **Code:** `backend/platform_core/errors.py`
- **Tests:** `backend/platform_core/tests/test_errors.py`
- Every API error, including 404, CSRF and server errors, is `{"error": {code, message, request_id, fields?}}`; codes are listed in `ERROR_CODES`.

### P1.3 Request correlation ID
- **Code:** `backend/platform_core/request_context.py`, `backend/platform_core/middleware.py`, `backend/platform_core/logging.py`
- **Tests:** `backend/platform_core/tests/test_request_context.py`
- Decision: D-020.

### P1.4 Pagination and filters
- **Code:** `backend/platform_core/pagination.py`, `backend/platform_core/filtering.py`
- **Tests:** `backend/platform_core/tests/test_pagination.py`
- Own keyset implementation: DRF's cursor pagination failed backward paging on tied timestamps. Decision: D-016.

### P1.5 Idempotent creates
- **Code:** `backend/platform_core/idempotency.py`, `backend/platform_core/migrations/0001_idempotency_record.py`, `backend/platform_core/management/commands/purge_idempotency_records.py`
- **Tests:** `backend/platform_core/tests/test_idempotency.py`
- Decision: D-014.

### P1.6 Version-checked edits
- **Code:** `backend/platform_core/concurrency.py`
- **Tests:** `backend/platform_core/tests/test_concurrency.py`
- The version travels in the request body. The project documents also ask for `ETag`/`If-Match` headers; they arrive with the first editable resource (D-015).

### P1.7 Time handling
- **Code:** `backend/platform_core/timeutils.py`, `backend/platform_core/fields.py`
- **Tests:** `backend/platform_core/tests/test_timeutils.py`
- Decision: D-017.

### P1.8 OpenAPI contract
- **Code:** `backend/platform_core/openapi.py`, `backend/openapi.yaml`
- **Tests:** `backend/platform_core/tests/test_openapi.py`, `backend/scripts/ci.sh`
- Decision: D-019.

### P1.9 Module template and boundaries
- **Code:** `backend/platform_core/app_template/`, `backend/platform_core/boundaries.py`, `backend/platform_core/checks.py`
- **Tests:** `backend/platform_core/tests/test_architecture.py`, `backend/platform_core/tests/reference/`
- `platform_core/tests/reference/` is a test-only module that uses every convention through real HTTP calls: copy its shape.

## Acceptance criteria

- [x] All nine conventions implemented once in `platform_core` and used by the reference module.
- [x] A cross-module import of anything but `services`/`selectors` fails `manage.py check`.
- [x] Two simultaneous edits: exactly one succeeds, the other gets 409.
- [x] A duplicated create returns the original response, never a second record.

## Acceptance evidence

- 2026-11-24: PR #3 merged (`dbb8793`); 135 tests, 94% coverage; Docker stack check 19/19.
- 2026-11-26: full backend pipeline green (202 tests including P2).

## Progress log

- 2026-11-24 · P1.1–P1.9 · f584668, bdadf3d · kernel and OpenAPI contract check; merged in PR #3.
