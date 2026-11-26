"""Re-checks the signed-in identity and its workspace context on every request.

Runs after Django's AuthenticationMiddleware and sets `request.workspace_context`
(platform_core.workspace):

- A session whose account was deactivated (or deleted) since sign-in is ended
  outright: Django already treats the user as anonymous; the session is flushed
  so reactivating the account cannot revive it.
- The stored context ID is resolved against the database (one query). If the
  membership was removed or suspended, left its validity window, or the
  organization was suspended, the context is forgotten immediately, so the
  very next request is denied, not the next sign-in.
"""

import logging
from collections.abc import Callable

from django.contrib.auth import SESSION_KEY
from django.http import HttpRequest, HttpResponse

from organizations.selectors import find_context

from .services import CONTEXT_SESSION_KEY, forget_context

logger = logging.getLogger(__name__)


class WorkspaceContextMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request.workspace_context = None  # type: ignore[attr-defined]
        session = getattr(request, "session", None)
        if session is not None and SESSION_KEY in session:
            user = request.user
            if not user.is_authenticated:
                session.flush()
                logger.info("Session ended: the account is no longer active")
            else:
                context_id = session.get(CONTEXT_SESSION_KEY)
                if context_id:
                    context = find_context(user, str(context_id))
                    if context is None:
                        forget_context(request, ended=True)
                        logger.info("Workspace context ended user=%s", user.public_id)
                    else:
                        request.workspace_context = context  # type: ignore[attr-defined]
        return self.get_response(request)
