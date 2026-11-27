"""The policy engine and catalogue reads (the access module's public read interface).

"May this actor do this to that?" is answered here and nowhere else (P3.2). The
formula (HO §09, FSD §11), checked in order:

1. Active membership: the request acts in a verified workspace context.
   accounts.middleware re-checks it on every request, so a context that exists
   is a membership that is active right now. The Individual workspace grants no
   organization permissions.
2. Event participation (from P5): a record owned by *another* organization is
   visible only through a participation gate (access.services.register_participation_gate),
   which names the profile the actor's organization takes part with.
3. The role grants the permission, and, for another organization's record, the
   participation profile grants it too.
4. Field visibility: the owner sees every field; a participant sees only the
   fields shared with its profile (SharedField). Nothing is shared by default.
5. Data rights: later phases.

Views use platform_core.authorization (RequirePermission, allowed_actions, deny),
which this engine is plugged into (access.apps). Lists start from
scope_to_context() so counts, lists, search and exports can never disagree (P3.3).
"""

from collections.abc import Iterable
from contextvars import ContextVar
from typing import Any

from django.db.models import Q, QuerySet

from platform_core.authorization import Resource
from platform_core.request_context import get_request_id
from platform_core.workspace import WorkspaceContext

from .models import Permission, Role, RolePermission, SharedField
from .services import participation_gates

# Per-request memo of role → permissions, so one request asking several
# questions costs one query per role. Keyed by request ID; never shared across requests.
_memo: ContextVar[tuple[str, dict[str, frozenset[str]]] | None] = ContextVar("access_memo", default=None)


def role_permissions(role_code: str) -> frozenset[str]:
    """Permission codes granted by a role (empty for unknown roles)."""
    if not role_code:
        return frozenset()
    request_id = get_request_id()
    memo = _memo.get()
    if request_id is not None and memo is not None and memo[0] == request_id and role_code in memo[1]:
        return memo[1][role_code]
    codes = frozenset(RolePermission.objects.filter(role__code=role_code).values_list("permission__code", flat=True))
    if request_id is not None:
        cache = memo[1] if memo is not None and memo[0] == request_id else {}
        cache[role_code] = codes
        _memo.set((request_id, cache))
    return codes


def permissions_for(context: WorkspaceContext | None) -> frozenset[str]:
    """What the context's role may do on its own organization's records."""
    if context is None or context.is_individual:
        return frozenset()
    return role_permissions(context.role)


def participation_profile(context: WorkspaceContext, resource: Resource) -> str | None:
    """The profile the context's organization takes part with in `resource`'s event, if any."""
    for gate in participation_gates():
        profile = gate(context, resource)
        if profile:
            return profile
    return None


def _profile_permissions(profile_code: str) -> frozenset[str]:
    return frozenset(Permission.objects.filter(profiles__code=profile_code).values_list("code", flat=True))


def is_visible(context: WorkspaceContext | None, resource: Resource) -> bool:
    """Whether the context may know `resource` exists (its owner, or a participant)."""
    if context is None or context.is_individual:
        return False
    if resource.owner_organization_id == context.organization_id:
        return True
    return participation_profile(context, resource) is not None


def can(context: WorkspaceContext | None, permission: str, resource: Resource | None = None) -> bool:
    """The policy decision: may the context perform `permission` (on `resource`)?"""
    if context is None or context.is_individual:
        return False
    if permission not in permissions_for(context):
        return False
    if resource is None or resource.owner_organization_id == context.organization_id:
        return True
    profile = participation_profile(context, resource)
    return profile is not None and permission in _profile_permissions(profile)


def visible_fields(
    context: WorkspaceContext | None, resource_type: str, resource: Resource, fields: Iterable[str]
) -> set[str]:
    """The subset of `fields` of `resource` the context may see (step 4)."""
    wanted = set(fields)
    if context is None or context.is_individual:
        return set()
    if resource.owner_organization_id == context.organization_id:
        return wanted
    profile = participation_profile(context, resource)
    if profile is None:
        return set()
    shared = SharedField.objects.filter(resource=resource_type, profile__code=profile, field__in=wanted)
    return set(shared.values_list("field", flat=True))


def scope_to_context(
    queryset: QuerySet[Any],
    context: WorkspaceContext | None,
    *,
    owner_field: str = "organization_id",
    by_public_id: bool = False,
    shared: Q | None = None,
) -> QuerySet[Any]:
    """Only the rows the context may see: its organization's own, plus `shared` (participation, from P5).

    `owner_field` holds the owning organization's internal key, or its public UUID
    when `by_public_id` is set. Without an organization context the result is empty.
    """
    if context is None or context.is_individual:
        return queryset.none()
    owner = context.organization_public_id if by_public_id else context.organization_id
    condition = Q(**{owner_field: owner})
    if shared is not None:
        condition |= shared
    return queryset.filter(condition)


# --- Catalogue ------------------------------------------------------------------


def assignable_role(code: str, organization_kind: str) -> Role | None:
    """The role if it may be given to a member of this kind of organization, else None."""
    role = Role.objects.filter(code=code, is_assignable=True).first()
    if role is None or (role.organization_kinds and organization_kind not in role.organization_kinds):
        return None
    return role


def assignable_roles(organization_kind: str) -> list[Role]:
    """Roles a member of this kind of organization may be given, by name."""
    roles = Role.objects.filter(is_assignable=True).order_by("name")
    return [r for r in roles if not r.organization_kinds or organization_kind in r.organization_kinds]


def role_names(codes: Iterable[str]) -> dict[str, str]:
    """Display names of the given role codes (codes without a role are left out)."""
    return dict(Role.objects.filter(code__in=set(codes)).values_list("code", "name"))


def catalogue() -> list[Role]:
    """Every role with its permissions (operator command and documentation)."""
    return list(Role.objects.prefetch_related("permissions").order_by("code"))


def permission_exists(code: str) -> bool:
    return Permission.objects.filter(code=code).exists()
