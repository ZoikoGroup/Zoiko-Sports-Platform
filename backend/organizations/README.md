# organizations

**Purpose:** organizations, memberships and invitations, and the rule for which workspace
contexts a person may act in right now.
**Built in:** P2 ([roadmap](../docs/roadmap/P02-identity.md)). **Owner:** Developer A.

## Models

| Model | Notes |
|---|---|
| `Organization` | Kind organizer / venue / club; status pending → active → suspended; `verified_at`. New organizations start pending (D-025) |
| `Membership` | User × organization with a `role` from the access catalogue (stored by its code), status active / suspended / revoked, optional validity window |
| Database rules | Allowed kinds and statuses; an active organization is verified; a validity window ends after it starts; invitation emails are lower case; accepted or revoked invitations record when (D-046) |
| `Invitation` | Organization, email, role, `token_hash` (SHA-256; the token itself is never stored), status pending / accepted / revoked, `expires_at`. At most one pending invitation per organization and email |

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `selectors.eligible_contexts(user)` | read | Every context the user may act in now, in sign-in tile order |
| `selectors.find_context(user, context_id)` | read | One context if still eligible, else `None` (one query at most) |
| `selectors.active_memberships(user)` | read | Memberships that currently grant a workspace |
| `selectors.invitation_for_token(token)` | read | The invitation an emailed token belongs to |
| `services.create_organization`, `ensure_organization` | write | Create (pending, or verified for the demo seed) |
| `services.verify_organization`, `suspend_organization`, `reinstate_organization` | write | Organization status changes |
| `services.grant_membership`, `set_membership_status` | write | Add a member; suspend or revoke one |
| `services.create_invitation`, `revoke_invitation`, `accept_invitation` | write | The invitation lifecycle (D-026, D-027, D-028) |

A context exists only while the account is active, the membership is active and inside its
validity window, and the organization is active. The Individual workspace needs an individual
profile (D-024).

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/invitations/preview/` | Anonymous preview: organization, role, masked email, state |
| `POST /api/v1/invitations/accept/` | Signed-in user accepts; the new context becomes active |

The emailed link is `<FRONTEND_URL>/invitations/accept#token=…`: the token travels in the URL
fragment, which browsers never send to servers.

## Operator command (until Internal Administration, P12.6)

`python manage.py organizations <action>`: `list`, `create` (`--verified`), `verify`, `suspend`,
`reinstate`, `invite` (`--email`, `--role`, `--expires-days 1–30`), `revoke-invitation`,
`remove-member` (`--suspend`). The token is never printed by the command itself.

## Events, permissions, audit

- **Events:** `events.py` is reserved; invitation and membership events arrive with P4.
- **Permissions:** `policies.py` is reserved; who may invite is decided by P3 (D-032).
- **Audit:** P3.7.

## Tests

| File | Covers |
|---|---|
| `tests/test_contexts.py` | Context resolution rules |
| `tests/test_identity_api.py` | Sign-in resolution, switching, revocation on the next request |
| `tests/test_invitations.py` | Issue, preview, accept, expiry, mismatch, concurrency |
| `tests/test_commands.py` | The operator command |
| `tests/test_migrations.py` | Upgrade from the pre-P2 schema |

## Known gaps

- Self-service invitations (P2.7 → P12.3).
- No `version` column yet on organizations and memberships: added with the first API that edits them (P12.3, D-046).
