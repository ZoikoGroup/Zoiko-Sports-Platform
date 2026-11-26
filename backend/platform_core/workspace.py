"""The workspace context a request acts in.

A signed-in person acts for one context at a time: one of their organization
memberships (Organizer, Venue or Team / Club workspace), or their personal
Individual workspace. The identity layer (accounts.middleware) re-checks the
stored context on every request and sets `request.workspace_context`:

- a WorkspaceContext while the membership, the organization and the account are
  all still active;
- None when no context has been chosen yet, or the stored one stopped being
  valid (membership removed or suspended, organization suspended). The session
  forgets it, so access ends on the very next request.

Kernel code only reads the attribute; resolving it is the identity layer's job.
Module views that act for an organization require it explicitly:

    permission_classes = [IsAuthenticated, HasWorkspaceContext]
    ...
    context = require_workspace_context(request)
    Competition.objects.filter(organization_id=context.organization_id)
"""

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from rest_framework import status
from rest_framework.permissions import BasePermission

from .errors import ApiError

INDIVIDUAL_CONTEXT_ID = "individual"

CONTEXT_REQUIRED_MESSAGE = "Choose a workspace to continue."


@dataclass(frozen=True)
class WorkspaceContext:
    # "individual", or the organization's public UUID as a string.
    id: str
    # organization, venue, club or individual (accounts.models.AccountType).
    account_type: str
    # Internal primary key, for scoping queries; never sent to clients.
    organization_id: int | None = None
    organization_public_id: UUID | None = None
    organization_name: str = ""
    # organizer, venue or club; empty for the Individual workspace.
    organization_kind: str = ""
    # Role code (access.Role) and its display name; empty for the Individual workspace.
    role: str = ""
    role_name: str = ""

    @property
    def is_individual(self) -> bool:
        return self.organization_id is None


# The context of the request being handled, for code that has no request object
# (services writing audit entries). Set by the identity layer on every request.
_current: ContextVar[WorkspaceContext | None] = ContextVar("workspace_context", default=None)


def set_current_context(context: WorkspaceContext | None) -> None:
    _current.set(context)


def current_context() -> WorkspaceContext | None:
    """The workspace context of the request being handled (None outside a request or without one)."""
    return _current.get()


def get_workspace_context(request: Any) -> WorkspaceContext | None:
    """The request's verified context, or None (works for Django and DRF requests)."""
    return getattr(request, "workspace_context", None)


def require_workspace_context(request: Any) -> WorkspaceContext:
    context = get_workspace_context(request)
    if context is None:
        raise ApiError("context_required", CONTEXT_REQUIRED_MESSAGE, status.HTTP_403_FORBIDDEN)
    return context


class HasWorkspaceContext(BasePermission):
    """Allows the request only while it acts in a verified workspace context (403 context_required)."""

    def has_permission(self, request: Any, view: Any) -> bool:
        require_workspace_context(request)
        return True
