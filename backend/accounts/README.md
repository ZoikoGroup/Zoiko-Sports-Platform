# accounts

**Purpose:** people and their sessions: registration, email verification, sign-in and sign-out,
password reset, and which workspace context the session is acting for.
**Built in:** the first sign-in slice, then P2 ([roadmap](../docs/roadmap/P02-identity.md)).
**Owner:** shared (both developers review changes).

## Models

| Model | Notes |
|---|---|
| `User` | Email is the login; `public_id` (UUID) is the ID in the API (D-018); `has_individual_profile` gives the Individual workspace. Passwords hashed with Argon2id (D-029) |
| `AccountType` | The four sign-in tiles (organization, venue, club, individual); a preference only (D-030) |

Organizations and memberships live in the [`organizations`](../organizations/README.md) module.

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

- **Events:** none yet; sign-in and switching events arrive with P4.
- **Permissions:** public endpoints are throttled (`AUTH_THROTTLE_RATE`); `/me/*` needs a signed-in user. Role permissions arrive in P3.
- **Audit:** sign-in, sign-out, failed sign-in and switching are audited in P3.7.

## Management commands

- `seed_demo`: fictional golden-event accounts ([golden-event.md](../docs/golden-event.md));
  needs `ZS_DEMO_PASSWORD` and debug or `ZS_ALLOW_DEMO_SEED=true`.

## Tests

`accounts/tests.py` covers registration, verification, password reset, sign-in tiles, config
and the seed command. Context resolution, switching and revocation tests are in
`organizations/tests/test_identity_api.py`.

## Known gaps

- No audit trail yet (P3.7).
- No SSO, MFA or passkeys: the identity provider is undecided (K10, GI1); the SSO button says
  it is not available.
