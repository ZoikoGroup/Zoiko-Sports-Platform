"""gunicorn settings for the Zoiko Sports API container.

Logs are JSON on stdout, in the same shape as Django's (platform_core.logging),
so one collector parses both. Access lines carry the path without its query
string (tokens never reach the log) and no user agent or referrer.

Tunables (environment): GUNICORN_BIND, GUNICORN_WORKERS, GUNICORN_TIMEOUT,
GUNICORN_ACCESS_LOG (true/false).
"""

import os
import sys
from pathlib import Path
from typing import Any

from gunicorn.glogging import Logger

sys.path.insert(0, str(Path(__file__).resolve().parent))

from platform_core.logging import JsonFormatter

bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = int(os.environ.get("GUNICORN_WORKERS", "3"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "30"))
graceful_timeout = 30
keepalive = 5
# Restart workers periodically to contain slow memory growth; jitter avoids a
# simultaneous restart of every worker.
max_requests = 2000
max_requests_jitter = 200

accesslog = "-" if os.environ.get("GUNICORN_ACCESS_LOG", "true").lower() in {"1", "true", "yes", "on"} else None
errorlog = "-"


class JsonAccessLogger(Logger):
    """Access lines as structured fields instead of an Apache-style string."""

    def access(self, resp: Any, req: Any, environ: Any, request_time: Any) -> None:
        if not self.cfg.accesslog:
            return
        atoms = self.atoms(resp, req, environ, request_time)
        status = str(atoms["s"])
        self.access_log.info(
            "request",
            extra={
                "method": atoms["m"],
                "path": atoms["U"],
                "status": int(status) if status.isdigit() else status,
                "duration_ms": round(request_time.total_seconds() * 1000, 1),
                "bytes": atoms["B"],
                "remote_addr": atoms["h"],
                "protocol": atoms["H"],
            },
        )


logger_class = JsonAccessLogger

# gunicorn shallow-merges this over its own defaults, replacing whole sections:
# "root" must be given too, or the default root logger points at a handler that
# no longer exists and every worker fails to start.
logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": JsonFormatter}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "json", "stream": "ext://sys.stdout"}},
    "root": {"handlers": ["stdout"], "level": "INFO"},
    "loggers": {
        "gunicorn.error": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
        "gunicorn.access": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
    },
}
