"""Write operations of the identity module that other modules may call.

The active workspace context lives in the server-side session as its ID only;
accounts.middleware re-resolves it against the database on every request.
"""

import logging
from typing import Any

from audit.services import record
from platform_core.workspace import WorkspaceContext, set_current_context

logger = logging.getLogger(__name__)

CONTEXT_SESSION_KEY = "zs.context"
# Set when a context stopped being valid mid-session, until another is chosen.
CONTEXT_ENDED_SESSION_KEY = "zs.context_ended"
# Django's authentication and expiry entries survive a context switch; every
# other session value is scoped to the context and is dropped with it.
_KEPT_SESSION_PREFIXES = ("_auth_user_", "_session_expiry")


def _drop_context_scoped_state(session: Any) -> None:
    for key in list(session.keys()):
        if not key.startswith(_KEPT_SESSION_PREFIXES):
            del session[key]


def activate_context(request: Any, context: WorkspaceContext, *, rotate_session: bool = True) -> None:
    """Make `context` the request's active context, clearing state scoped to the previous one.

    The caller must have verified `context` for this user (organizations.selectors).
    The session ID is rotated unless sign-in has just rotated it.
    """
    session = request.session
    if rotate_session:
        session.cycle_key()
    _drop_context_scoped_state(session)
    session[CONTEXT_SESSION_KEY] = context.id
    request.workspace_context = context
    set_current_context(context)
    record("workspace.context_activated", actor=request.user, context=context)
    logger.info("Workspace context activated user=%s workspace=%s", request.user.public_id, context.account_type)


def forget_context(request: Any, *, ended: bool) -> None:
    """Drop the active context; `ended` records that it stopped being valid (shown to the user once chosen again)."""
    previous = request.session.pop(CONTEXT_SESSION_KEY, None)
    if ended:
        request.session[CONTEXT_ENDED_SESSION_KEY] = True
        record(
            "workspace.context_ended",
            actor=request.user,
            context=None,
            target=("workspace", previous) if previous else None,
        )
    request.workspace_context = None
    set_current_context(None)
