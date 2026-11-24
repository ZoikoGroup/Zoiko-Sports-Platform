"""Liveness and readiness probes for container orchestration and load balancers.

- Liveness  (/api/v1/health/live/):  the process is up and serving requests. No
  dependencies are touched, so a database outage never restarts the app.
- Readiness (/api/v1/health/ready/): the instance can do useful work: the
  database answers and every migration is applied. Traffic should only be
  routed to ready instances.

Plain Django views (no DRF, session, CSRF or throttling) keep probes cheap. The
bodies name each check and its state only; failure details go to the server
log, never to the caller.
"""

import logging
from collections.abc import Callable
from functools import wraps
from typing import Literal

from django.db import DatabaseError, connection
from django.db.migrations.executor import MigrationExecutor
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.cache import never_cache

from .errors import method_not_allowed

logger = logging.getLogger(__name__)

SAFE_METHODS = ["GET", "HEAD"]


def require_safe(view: Callable[[HttpRequest], HttpResponse]) -> Callable[[HttpRequest], HttpResponse]:
    """GET and HEAD only; anything else gets 405 in the platform error envelope."""

    @wraps(view)
    def wrapper(request: HttpRequest) -> HttpResponse:
        if request.method not in SAFE_METHODS:
            return method_not_allowed(SAFE_METHODS)
        return view(request)

    return wrapper


CheckState = Literal["ok", "unavailable", "pending"]

# Applied migrations never become unapplied while the process runs, so once the
# plan is empty there is no need to load the migration graph again.
_migrations_applied = False


def _check_database() -> CheckState:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        logger.warning("Readiness: database unavailable", exc_info=True)
        return "unavailable"
    return "ok"


def _check_migrations() -> CheckState:
    global _migrations_applied
    if _migrations_applied:
        return "ok"
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    except DatabaseError:
        logger.warning("Readiness: could not read the migration state", exc_info=True)
        return "unavailable"
    if plan:
        logger.warning("Readiness: %d migration(s) not applied", len(plan))
        return "pending"
    _migrations_applied = True
    return "ok"


@never_cache
@require_safe
def live(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


@never_cache
@require_safe
def ready(request: HttpRequest) -> JsonResponse:
    checks: dict[str, CheckState] = {"database": _check_database()}
    checks["migrations"] = _check_migrations() if checks["database"] == "ok" else "unavailable"
    healthy = all(state == "ok" for state in checks.values())
    return JsonResponse(
        {"status": "ok" if healthy else "unavailable", "checks": checks}, status=200 if healthy else 503
    )
