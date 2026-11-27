"""Write operations of the access module (the public write interface).

- Participation gates: modules that own events (competitions, from P5) register a
  function telling the policy engine in which capacity an organization takes part
  in a resource's event. With no gate registered, other organizations' records are
  invisible (deny by default).
- Catalogue changes (granting or revoking a permission of a role) are audited;
  the change applies to every member with that role on their next request.
"""

from collections.abc import Callable

from django.db import transaction
from rest_framework import status

from audit.services import record
from platform_core.authorization import Resource
from platform_core.errors import ApiError
from platform_core.workspace import WorkspaceContext

from .models import Permission, Role, RolePermission

ParticipationGate = Callable[[WorkspaceContext, Resource], str | None]
_gates: list[ParticipationGate] = []


def register_participation_gate(gate: ParticipationGate) -> None:
    """Add a gate (idempotent): gate(context, resource) -> profile code or None."""
    if gate not in _gates:
        _gates.append(gate)


def unregister_participation_gate(gate: ParticipationGate) -> None:
    if gate in _gates:
        _gates.remove(gate)


def participation_gates() -> tuple[ParticipationGate, ...]:
    return tuple(_gates)


def _role_and_permission(role_code: str, permission_code: str) -> tuple[Role, Permission]:
    role = Role.objects.filter(code=role_code).first()
    permission = Permission.objects.filter(code=permission_code).first()
    if role is None or permission is None:
        raise ApiError(
            "not_found",
            f"Unknown {'role ' + role_code if role is None else 'permission ' + permission_code}.",
            status.HTTP_404_NOT_FOUND,
        )
    return role, permission


def grant_permission(role_code: str, permission_code: str) -> bool:
    """Let `role_code` do `permission_code`; False when it already could."""
    with transaction.atomic():
        role, permission = _role_and_permission(role_code, permission_code)
        _, created = RolePermission.objects.get_or_create(role=role, permission=permission)
        if created:
            record("access.permission_granted", target=("role", role.code), details={"permission": permission.code})
    return created


def revoke_permission(role_code: str, permission_code: str) -> bool:
    """Stop `role_code` doing `permission_code`; False when it already couldn't."""
    with transaction.atomic():
        role, permission = _role_and_permission(role_code, permission_code)
        deleted, _ = RolePermission.objects.filter(role=role, permission=permission).delete()
        if deleted:
            record("access.permission_revoked", target=("role", role.code), details={"permission": permission.code})
    return bool(deleted)
