"""Per-request correlation ID shared by logs, error responses and (later) audit and events.

The ID arrives in X-Request-ID (nginx sets it from $request_id in the Docker stack)
or is generated here. It lives in a context variable for the duration of the
request, so any code can read it without passing the request around, and
background work can set its own with `request_context()`.
"""

import re
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

REQUEST_ID_HEADER = "X-Request-ID"

# Accepted incoming IDs: short and log-safe (no spaces, quotes or control
# characters), so a caller cannot inject text into log lines.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def new_request_id() -> str:
    return uuid.uuid4().hex


def accept_request_id(candidate: str | None) -> str:
    """The incoming ID if it is well-formed, otherwise a newly generated one."""
    if candidate and _VALID_REQUEST_ID.fullmatch(candidate):
        return candidate
    return new_request_id()


def get_request_id() -> str | None:
    """The current request's correlation ID, or None outside a request context."""
    return _request_id.get()


@contextmanager
def request_context(request_id: str | None = None) -> Iterator[str]:
    """Run a block with a correlation ID (a new one unless given); restores the previous one after."""
    value = accept_request_id(request_id)
    token = _request_id.set(value)
    try:
        yield value
    finally:
        _request_id.reset(token)
