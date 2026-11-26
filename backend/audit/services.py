"""Recording audit entries (the audit module's public write interface).

    record("invitation.accepted", actor=user, target=("invitation", invitation.public_id))

- Inside a transaction, the entry commits or rolls back with the change it
  describes. A refusal (outcome "denied") is recorded outside the refused
  operation's transaction, so the refusal itself is kept.
- The acting organization and role default to the current request's workspace
  context (platform_core.workspace.current_context); the correlation ID to the
  current request's ID. Outside a request they are empty (operator commands).
- Never pass personal data (emails, names), tokens or passwords in `details`.
"""

import re
from typing import Any
from uuid import UUID

from django.utils import timezone

from platform_core.request_context import get_request_id
from platform_core.workspace import WorkspaceContext, current_context

from .models import AuditEntry

ACTION_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")
_UNSET: Any = object()


def _actor_id(actor: Any) -> UUID | None:
    if actor is None:
        return None
    if isinstance(actor, UUID):
        return actor
    if getattr(actor, "is_authenticated", False):
        return actor.public_id
    return None


def record(
    action: str,
    *,
    outcome: str = AuditEntry.Outcome.SUCCESS,
    actor: Any = None,
    context: WorkspaceContext | None = _UNSET,
    target: tuple[str, Any] | None = None,
    before_version: int | None = None,
    after_version: int | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEntry:
    """Append one entry. `actor` is a user or a user's public UUID; `target` is (type, id)."""
    if not ACTION_PATTERN.match(action):
        raise ValueError(f"Audit action {action!r} must look like 'thing.happened'.")
    if outcome not in AuditEntry.Outcome.values:
        raise ValueError(f"Unknown audit outcome {outcome!r}.")
    acting = current_context() if context is _UNSET else context
    organization_id = None if acting is None or acting.is_individual else acting.organization_public_id
    return AuditEntry.objects.create(
        occurred_at=timezone.now(),
        action=action,
        outcome=outcome,
        actor_id=_actor_id(actor),
        organization_id=organization_id,
        role="" if acting is None else acting.role,
        target_type=target[0] if target else "",
        target_id=str(target[1]) if target else "",
        before_version=before_version,
        after_version=after_version,
        request_id=get_request_id() or "",
        details=details or {},
    )
