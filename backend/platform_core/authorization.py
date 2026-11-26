"""Authorization building blocks every module's views use (P3).

The kernel defines *how* a permission is asked for; the `access` module decides
*whether* it is granted. `access` registers its policy engine at start-up
(`set_permission_checker`); until something is registered every check is denied,
so a missing engine can never open access.

In a view:

    permission_classes = [IsAuthenticated, HasWorkspaceContext, RequirePermission("activity.view")]

Response rule (FSD §11, HO §09):
- a resource the caller may not see answers 404, so its existence is not revealed;
- a visible resource with a forbidden action answers 403.
`deny(visible=...)` raises the right one.

Anonymous endpoints say so explicitly: DRF views with `permission_classes =
[Public]`, plain Django views with `@public_endpoint`. The system check
platform_core.E002 fails the build for any /api/ endpoint without an explicit rule.
"""

from collections.abc import Callable, Iterable
from typing import Any, NoReturn, Protocol

from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission

from .errors import ApiError
from .workspace import WorkspaceContext, require_workspace_context

PERMISSION_DENIED_MESSAGE = "You don't have permission to do this in this workspace."
NOT_FOUND_MESSAGE = "Not found."


class Resource(Protocol):
    """Anything a permission can be checked against: it belongs to one organization (internal key)."""

    @property
    def owner_organization_id(self) -> int: ...


PermissionChecker = Callable[[WorkspaceContext | None, str, Resource | None], bool]


def _deny_everything(context: WorkspaceContext | None, permission: str, resource: Resource | None) -> bool:
    return False


_checker: PermissionChecker = _deny_everything


def set_permission_checker(checker: PermissionChecker | None) -> None:
    """Install the policy engine (access.apps); None restores deny-everything."""
    global _checker
    _checker = checker or _deny_everything


def has_permission(context: WorkspaceContext | None, permission: str, resource: Resource | None = None) -> bool:
    """Whether the context may perform `permission` (on `resource`, if given)."""
    return _checker(context, permission, resource)


def allowed_actions(
    context: WorkspaceContext | None, actions: Iterable[str], resource: Resource | None = None
) -> list[str]:
    """The subset of `actions` the context may perform, in the given order (P3.5)."""
    return [action for action in actions if has_permission(context, action, resource)]


def deny(*, visible: bool) -> NoReturn:
    """Refuse a request: 404 when the caller may not see the resource, else 403 (P3.4)."""
    if not visible:
        raise ApiError("not_found", NOT_FOUND_MESSAGE, status.HTTP_404_NOT_FOUND)
    raise ApiError("permission_denied", PERMISSION_DENIED_MESSAGE, status.HTTP_403_FORBIDDEN)


def RequirePermission(permission: str) -> type[BasePermission]:
    """A DRF permission class requiring an active workspace context that grants `permission`."""

    class _RequirePermission(BasePermission):
        required_permission = permission

        def has_permission(self, request: Any, view: Any) -> bool:
            context = require_workspace_context(request)
            if not has_permission(context, permission):
                deny(visible=True)
            return True

    _RequirePermission.__name__ = _RequirePermission.__qualname__ = f"RequirePermission[{permission}]"
    return _RequirePermission


# Explicitly anonymous: the endpoint is meant for callers who are not signed in. An alias
# (not a subclass) so the OpenAPI generator still documents these endpoints as anonymous.
Public = AllowAny


def public_endpoint(view: Callable[..., Any]) -> Callable[..., Any]:
    """Marks a plain Django view as deliberately anonymous (see platform_core.E002)."""
    view.public_endpoint = True  # type: ignore[attr-defined]
    return view
