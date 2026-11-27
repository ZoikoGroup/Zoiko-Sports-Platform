"""Housekeeping: each module registers what it cleans up; one call runs everything.

    register("outbox.purge_delivered", purge_old_events)   # in the module's AppConfig.ready

`run_all()` runs every task, logs how many rows each removed, and keeps going if
one fails. It is idempotent, so running it twice (two workers) is harmless.

Who runs it: the outbox worker every MAINTENANCE_INTERVAL_HOURS (0 = never), and
operators with `python manage.py maintenance`.

Never registered here: the audit trail (append-only; its retention waits for the
legal decision D09) and the activity feed (kept).
"""

import logging
from collections.abc import Callable
from importlib import import_module

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# A task removes what has expired and returns how many rows it removed.
Task = Callable[[], int]
_tasks: dict[str, Task] = {}


def register(name: str, task: Task) -> None:
    if "." not in name:
        raise ValueError("Task names look like '<module>.<what>', e.g. outbox.purge_delivered.")
    _tasks[name] = task


def registered() -> list[str]:
    return sorted(_tasks)


def run_all() -> dict[str, int | None]:
    """Run every task; the result maps each task to rows removed (None when it failed)."""
    results: dict[str, int | None] = {}
    for name in registered():
        try:
            removed = _tasks[name]()
        except Exception:
            logger.exception("Maintenance task failed task=%s", name)
            results[name] = None
        else:
            logger.info("Maintenance task done task=%s removed=%d", name, removed)
            results[name] = removed
    return results


def clear_expired_sessions() -> int:
    """Expired sign-in sessions (what Django's `clearsessions` does)."""
    engine = import_module(settings.SESSION_ENGINE)
    if settings.SESSION_ENGINE == "django.contrib.sessions.backends.db":
        from django.contrib.sessions.models import Session

        removed, _ = Session.objects.filter(expire_date__lt=timezone.now()).delete()
        return removed
    engine.SessionStore.clear_expired()  # other engines report no count
    return 0


def purge_idempotency_records() -> int:
    from .idempotency import purge_expired

    return purge_expired(1000)
