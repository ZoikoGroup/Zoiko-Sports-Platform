"""Structured (JSON) log output.

One JSON object per line, so log collectors can index fields instead of parsing
text. Imports only the standard library: it is loaded by Django's logging setup
and by the gunicorn configuration, before Django apps are ready.
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any

from .request_context import get_request_id

# Attributes every LogRecord has; anything else was passed through `extra=`.
_RECORD_ATTRIBUTES = frozenset(vars(logging.LogRecord("", 0, "", 0, "", (), None))) | {"message", "asctime"}

# Extras that are objects rather than values (Django attaches the whole request
# to django.request records); never serialised, so request bodies, cookies and
# headers cannot leak into logs.
_EXCLUDED_EXTRAS = frozenset({"request", "server_time"})

_SCALAR = (str, int, float, bool, type(None))


class RequestContextFilter(logging.Filter):
    """Adds the request's correlation ID to every record (attach it to handlers).

    The ID comes from the request context, or from the request attached to the
    record: Django logs 4xx/5xx responses ("django.request") after the
    middleware has returned, when the context has already ended.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            request_id = get_request_id() or getattr(getattr(record, "request", None), "request_id", None)
            if isinstance(request_id, str):
                record.request_id = request_id
        return True


class JsonFormatter(logging.Formatter):
    """timestamp (UTC, ISO 8601), level, logger, message, plus scalar extras."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _RECORD_ATTRIBUTES or key in _EXCLUDED_EXTRAS or key.startswith("_") or key in payload:
                continue
            if isinstance(value, _SCALAR):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)
        return json.dumps(payload, ensure_ascii=False, default=str)
