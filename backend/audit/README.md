# audit

**Purpose:** the append-only audit trail: one row per security-relevant action, the
restricted compliance record.
**Built in:** P3 ([roadmap](../docs/roadmap/P03-permissions-audit.md)). **Owner:** Developer A.

## Models

| Model | Notes |
|---|---|
| `AuditEntry` | `occurred_at`, `action` (`thing.happened`), `outcome` (success / denied / failed), `actor_id` (user public UUID), `organization_id` + `role` (the acting workspace then), `target_type` / `target_id`, `before_version` / `after_version`, `request_id`, `details` (small, non-personal) |

A database trigger (migration `0002_append_only`) rejects every UPDATE and DELETE, whoever
issues them. Only identifiers are stored: never emails, names, tokens or passwords (D-042).

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.record(action, *, outcome, actor, context, target, before_version, after_version, details)` | write | Append one entry; acting organization, role and correlation ID default to the current request |
| `selectors.entries(action=…, actor_id=…, organization_id=…, limit=…)` | read | Newest first (operators; Reports from P12.4) |

Inside a transaction an entry commits or rolls back with its change. A refusal is recorded
outside the refused operation's transaction so it is kept.

## What is audited today

`auth.sign_in`, `auth.sign_in_failed`, `auth.sign_out` (Django's auth signals: API and admin),
`workspace.context_activated`, `workspace.context_ended`, `account.registered`,
`account.email_verified`, `account.password_changed`, `organization.created` / `verified` /
`suspended` / `reinstated`, `membership.granted` / `status_changed`, `invitation.created` /
`revoked` / `accepted` / `accept_refused`, `access.permission_granted` / `revoked`,
`outbox.replayed`.

## Endpoints

None yet: the trail is restricted. Reading it through the API is Reports & audit exports (P12.4),
behind `audit.view`.

## Operator command

`python manage.py audit [--limit N] [--action …] [--actor UUID] [--organization UUID]`.

## Tests

`tests/test_audit.py`: fields and defaults, database-enforced append-only (ORM and raw SQL),
every required action from real flows, no personal data in any row.

## Known gaps

- Tamper evidence (a hash chain, GS8) and retention (D09) come with production hardening (P11).
