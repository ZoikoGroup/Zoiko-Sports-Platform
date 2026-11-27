# access

**Purpose:** the role and permission catalogue (stored as data) and the policy engine that
answers "may this actor do this to that?" for every module.
**Built in:** P3 ([roadmap](../docs/roadmap/P03-permissions-audit.md)). **Owner:** Developer A.

## Models

| Model | Notes |
|---|---|
| `Permission` | One action code, `<resource>.<verb>` (e.g. `activity.view`) |
| `Role` | `code` (what memberships store), `name`, `organization_kinds` (empty = any kind), `is_assignable` (false for legacy roles kept from before the catalogue) |
| `RolePermission` | Which permissions a role grants |
| `ParticipationProfile` | The capacity an organization takes part in another's event with (club, venue, officials); used from P5 |
| `SharedField` | A field of another organization's record a profile may see; nothing is shared unless listed |

The seed catalogue (migration `0002_seed_catalogue`) is an assumption until the company signs off
the role catalogue (GP1, D-039). Later phases add their permissions in their own data migrations:
`readiness.view` and `readiness.request_update` (competition director, organizer coordinator) come
from `readiness/migrations/0002_permissions.py` (P12.1, D-047).

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `selectors.can(context, permission, resource=None)` | read | The policy decision (membership → participation → role → profile) |
| `selectors.is_visible(context, resource)` | read | Owner or participant: may it know the record exists? |
| `selectors.visible_fields(context, type, resource, fields)` | read | Field-level visibility (owner: all; participant: shared fields only) |
| `selectors.scope_to_context(queryset, context, owner_field=…)` | read | Rows the context may see; every list, count, search and export starts here |
| `selectors.permissions_for(context)`, `role_permissions(code)` | read | A role's permission codes (memoised per request) |
| `selectors.assignable_role(code, kind)`, `assignable_roles(kind)`, `role_names(codes)` | read | The catalogue |
| `services.register_participation_gate(gate)` | write | P5 plugs event participation into the engine here |
| `services.grant_permission(role, permission)`, `revoke_permission(…)` | write | Catalogue changes (audited) |

Views don't call the engine directly: they use `platform_core.authorization`
(`RequirePermission("activity.view")`, `allowed_actions()`, `deny(visible=…)`), which
`access.apps` plugs this engine into. Without it, everything is denied.

## Endpoints

None of its own. Its rules protect every other module's endpoints.

## Events, permissions, audit

- **Events:** none.
- **Audit:** `access.permission_granted`, `access.permission_revoked`.

## Operator command

`python manage.py access roles` lists the catalogue; `access grant <role> <permission>` and
`access revoke <role> <permission>` change it (audited; applies on members' next request).

## Tests

| File | Covers |
|---|---|
| `tests/test_policy.py` | Decision order, legacy roles, participation gates, field visibility, scoping, 404/403, memo, catalogue rules, operator command |
| `tests/test_permission_matrix.py` | Every role × every API endpoint on the golden event (fails if an endpoint is missing); Club C sees nothing else |
| `tests/golden.py` | The golden-event fixture used by several modules' tests |

## Known gaps

- The role catalogue and delegation rules are assumptions (GP1, GP2).
- No participation gate is registered until P5 (event participation), so other organizations'
  records are invisible by design.
