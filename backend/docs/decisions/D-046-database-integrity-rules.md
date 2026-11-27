# D-046 — The database enforces data integrity, not only the application

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Project lead |
| Phase | P2–P4 (schema corrections) |
| Company reference | — |

## Context

The schema audit of 2026-11-26 found every required table present, but several rules
enforced only by application code: allowed status values, lower-case unique email
addresses, timestamps that go with final states. A script, an admin edit or a bug could
store data the application never would. Some indexes duplicated existing ones, objects kept
pre-P2 names, and retention jobs existed without a schedule.

## Decision

- Every column with a fixed set of values gets a database CHECK constraint
  (`<table>_<column>_valid`), declared in the model's `Meta` from the same choice set the
  code uses. **New modules follow the same convention** (conventions.md).
- States that imply other values are checked too: an active organization is verified; a
  validity window ends after it starts; accepted or revoked invitations and done deliveries
  record when; codes and event names have their format.
- Email addresses are stored in lower case and unique whatever the capitals (also an index
  for case-insensitive sign-in lookups).
- Upgrades fix old rows first and stop with a clear message when they cannot (two accounts
  whose emails differ only in capitals; a reversed validity window).
- Indexes that only repeat the start of a unique index are not created; pre-P2 names are renamed.
- Housekeeping (expired sessions, idempotency records, delivered events older than
  OUTBOX_RETENTION_DAYS) runs from the worker every MAINTENANCE_INTERVAL_HOURS.
- Django's own `auth_*` permission tables serve only the staff admin; the product's
  permissions are the access catalogue.

## Consequences

- Migrations: `accounts 0004`, `organizations 0004`, `access 0003`, `audit 0003`, `outbox 0002`.
- Code: `platform_core/maintenance.py`, `manage.py maintenance`, the worker's schedule.
- Not done here, by design: version columns on organizations and memberships (with the
  first API that edits them, P12.3) and separate production database roles (P11.6).
- Django still creates its automatic pattern indexes on unique text columns
  (`..._like`); removing them would need SQL Django does not track, for no gain at this scale.

## Evidence (2026-11-26)

- Backend pipeline green: 328 tests (21 new for these rules and the housekeeping), 96% coverage,
  migrations match the models, API contract unchanged, image scan clean.
- Browser tests: 172 passed, 14 skipped, 0 failed. Docker stack check: 31/31, including the
  database refusing a misspelled status and an upper-case email, and the worker's housekeeping.
- A copy of the development database upgraded cleanly: every row kept, 20 rules in place, no
  pre-P2 names left.
