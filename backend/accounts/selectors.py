"""Read-only views of the signed-in identity (the module's public read interface)."""

from typing import Any
from uuid import UUID

from access.selectors import permissions_for
from organizations.selectors import eligible_contexts
from platform_core.workspace import WorkspaceContext, get_workspace_context

# The documented shape of session_payload(), for other modules' API schemas.
from .models import User
from .serializers import SessionSerializer
from .services import CONTEXT_ENDED_SESSION_KEY

__all__ = ["SessionSerializer", "context_data", "context_status", "session_payload", "user_names"]


def context_data(context: WorkspaceContext | None) -> dict[str, Any] | None:
    """A context as sent to clients: public IDs only, never internal keys."""
    if context is None:
        return None
    organization = None
    if not context.is_individual:
        organization = {
            "id": str(context.organization_public_id),
            "name": context.organization_name,
            "kind": context.organization_kind,
        }
    return {
        "id": context.id,
        "account_type": context.account_type,
        "organization": organization,
        "role": context.role or None,
        "role_name": context.role_name or None,
    }


def context_status(active: WorkspaceContext | None, contexts: list[WorkspaceContext]) -> str:
    if active is not None:
        return "active"
    return "selection_required" if contexts else "no_access"


def session_payload(request: Any) -> dict[str, Any]:
    """The signed-in user, their active context and every context they may switch to."""
    user = request.user
    active = get_workspace_context(request)
    contexts = eligible_contexts(user)
    return {
        "authenticated": True,
        "user": {"id": str(user.public_id), "email": user.email, "full_name": user.full_name},
        "context": context_data(active),
        "contexts": [context_data(c) for c in contexts],
        "context_status": context_status(active, contexts),
        "context_ended": active is None and bool(request.session.get(CONTEXT_ENDED_SESSION_KEY)),
        # What the active context's role may do (access catalogue), so the app shows only permitted actions.
        "permissions": sorted(permissions_for(active)),
    }


def user_names(public_ids: list[str]) -> dict[str, str]:
    """Display names (full name, else "A member") by user public UUID (as strings); unknown IDs are left out."""
    valid = []
    for value in public_ids:
        try:
            valid.append(UUID(str(value)))
        except ValueError:
            continue
    rows = User.objects.filter(public_id__in=valid).values_list("public_id", "full_name")
    return {str(public_id): (name or "A member") for public_id, name in rows}
