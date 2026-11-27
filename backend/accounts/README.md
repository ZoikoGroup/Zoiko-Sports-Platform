# accounts

**Purpose:** people and their sessions: registration, email verification, sign-in and sign-out,
password reset, and which workspace context the session is acting for.
**Built in:** the first sign-in slice, then P2 ([roadmap](../docs/roadmap/P02-identity.md)).
**Owner:** shared (both developers review changes).

## Models

| Model | Notes |
|---|---|
| `User` | Email is the login; `public_id` (UUID) is the ID in the API (D-018); `has_individual_profile` gives the Individual workspace. Passwords hashed with Argon2id (D-029) |
| `User` rules | Email stored in lower case (`user_email_lowercase`) and unique whatever the capitals (`user_email_unique_any_case`, also the index for case-insensitive lookups) (D-046) |
| `AccountType` | The four sign-in tiles (organization, venue, club, individual); a preference only (D-030) |

Organizations and memberships live in the [`organizations`](../organizations/README.md) module.

Django's own `auth_group`, `auth_permission`, `accounts_user_groups` and
`accounts_user_user_permissions` tables (from `PermissionsMixin`) serve only Django's staff
admin. The product's roles and permissions are the [`access`](../access/README.md) catalogue;
granting something in Django's tables changes nothing in the product (D-046).

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.activate_context(request, context, rotate_session=True)` | write | Make a verified context the session's active one (rotates the session, drops workspace-scoped state) |
| `services.forget_context(request, ended=…)` | write | Clear the active context (`ended=True` when access was lost) |
| `selectors.session_payload(request)` | read | The session shape every auth endpoint returns: user, context, contexts, `context_status` |
| `selectors.context_data`, `selectors.context_status` | read | Pieces of that payload |

## Endpoints

Full shapes in [`openapi.yaml`](../openapi.yaml); flows in the repository README §10.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/auth/csrf/`, `GET /api/v1/auth/config/`, `GET /api/v1/auth/session/` | CSRF cookie; sign-in page settings; current session |
| `POST /api/v1/auth/login/`, `POST /api/v1/auth/logout/` | Sign in (resolves contexts: 1 → enter, several → choose, none → no access); sign out |
| `POST /api/v1/auth/register/`, `…/verify-email/`, `…/verify-email/resend/` | Registration and email verification |
| `POST /api/v1/auth/password-reset/`, `…/password-reset/confirm/` | Password reset (non-enumerating) |
| `GET /api/v1/me/`, `GET /api/v1/me/contexts/` | The current user; their eligible contexts |
| `GET /api/v1/me/context/`, `PUT /api/v1/me/context/` | The active context; switch context (404 `context_not_found` if not eligible) |

## Request pipeline

`middleware.WorkspaceContextMiddleware` runs on every request after authentication. It ends
the session of a deactivated account, re-resolves the active context, and forgets it (logging
"Workspace context ended") when the membership or organization is no longer active. Views that
act for an organization use `platform_core.workspace.HasWorkspaceContext`.

## Events, permissions, audit

- **Events:** none published. Sign-in and switching are security records, so they go to the audit trail rather than the event stream (D-042).
- **Permissions:** public endpoints are throttled (`AUTH_THROTTLE_RATE`); `/me/*` needs a signed-in user. The session lists the active role's `permissions` (D-045).
- **Audit:** `auth.sign_in`, `auth.sign_in_failed`, `auth.sign_out` (`signals.py`), `workspace.context_activated` / `context_ended`, `account.registered`, `account.email_verified`, `account.password_changed`.

## Management commands

- `seed_demo`: fictional golden-event organizations and accounts ([golden-event.md](../docs/golden-event.md)),
  plus Riverside's demo competition and venue readiness at five fictional venues
  (`management/demo_readiness.py`, through the competitions and readiness services; D-047);
  needs `ZS_DEMO_PASSWORD` and debug or `ZS_ALLOW_DEMO_SEED=true`. Re-running creates nothing twice.

## Tests

`accounts/tests.py` covers registration, verification, password reset, sign-in tiles, config
and the seed command. Context resolution, switching and revocation tests are in
`organizations/tests/test_identity_api.py`.

## Known gaps

- No SSO, MFA or passkeys: the identity provider is undecided (K10, GI1); the SSO button says
  it is not available.
