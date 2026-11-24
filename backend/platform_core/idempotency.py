"""Idempotent writes: a retried request with the same Idempotency-Key returns the
original result instead of acting twice.

Apply to a DRF view method that creates something:

    class CompetitionList(APIView):
        @idempotent("competitions.create")
        def post(self, request): ...

For each (user, action, key):

1. A transaction-scoped PostgreSQL advisory lock is taken without waiting. If
   another request with the same key holds it, the caller gets 409
   `request_in_progress` at once.
2. A stored, unexpired record for the key is replayed: same status and body,
   plus `Idempotent-Replayed: true`. If the stored request differs (method,
   path or body), the caller gets 422 `idempotency_key_reused`.
3. Otherwise the view runs inside the same transaction. A 2xx result is stored
   with the outcome; anything else rolls the transaction back and stores
   nothing, so the client may retry with the same key.

The unique constraint on (user, action, key) backs the lock: one key can never
produce two stored outcomes. Keys belong to one user, so nobody can replay
someone else's key. Records expire after IDEMPOTENCY_TTL (default 24 hours);
expired records of the user are removed whenever the user stores a new one,
and `manage.py purge_idempotency_records` removes all of them.
"""

import hashlib
import json
import re
from collections.abc import Callable
from datetime import timedelta
from functools import wraps
from typing import Any, TypeVar, cast

from django.conf import settings
from django.db import connection, transaction
from django.http import QueryDict
from django.utils import timezone
from rest_framework import exceptions, status
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response

from .errors import ApiError
from .models import IdempotencyRecord

IDEMPOTENCY_HEADER = "Idempotency-Key"
REPLAYED_HEADER = "Idempotent-Replayed"

# Visible ASCII without spaces, at most 255 characters (a UUID is the expected form).
_VALID_KEY = re.compile(r"[\x21-\x7e]{1,255}")
# Namespace for the advisory-lock hash, so these locks never collide with other uses.
_LOCK_NAMESPACE = b"zoiko-sports:idempotency\x1f"

Handler = TypeVar("Handler", bound=Callable[..., Response])


def idempotency_ttl() -> timedelta:
    return cast(timedelta, getattr(settings, "IDEMPOTENCY_TTL", timedelta(hours=24)))


def _fingerprint(request: Request) -> str:
    data: Any = request.data
    if isinstance(data, QueryDict):
        data = {key: data.getlist(key) for key in sorted(data)}
    canonical = json.dumps(
        {"method": request.method, "path": request.path, "body": data},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _lock_id(user_pk: object, action: str, key: str) -> int:
    digest = hashlib.blake2b(_LOCK_NAMESPACE + f"{user_pk}\x1f{action}\x1f{key}".encode(), digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=True)


def _try_lock(lock_id: int) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [lock_id])
        row = cursor.fetchone()
    return bool(row and row[0])


def _replay(record: IdempotencyRecord) -> Response:
    response = Response(record.response_body, status=record.response_status)
    response[REPLAYED_HEADER] = "true"
    return response


def idempotent(action: str, *, required: bool = True) -> Callable[[Handler], Handler]:
    """Make a DRF view method idempotent under `action` (for example "competitions.create")."""
    if not action or len(action) > 100:
        raise ValueError("An idempotency action name of 1-100 characters is required.")

    def decorator(handler: Handler) -> Handler:
        @wraps(handler)
        def wrapper(view: Any, request: Request, *args: Any, **kwargs: Any) -> Response:
            key = request.headers.get(IDEMPOTENCY_HEADER, "")
            if not key:
                if required:
                    raise ApiError(
                        "idempotency_key_required",
                        "This request needs an Idempotency-Key header, for example a new UUID per submission.",
                    )
                return handler(view, request, *args, **kwargs)
            if not _VALID_KEY.fullmatch(key):
                raise ApiError(
                    "idempotency_key_invalid",
                    "The Idempotency-Key header must be 1-255 visible characters without spaces.",
                )
            user = request.user
            if not user.is_authenticated:
                raise exceptions.NotAuthenticated()
            fingerprint = _fingerprint(request)

            with transaction.atomic():
                if not _try_lock(_lock_id(user.pk, action, key)):
                    raise ApiError(
                        "request_in_progress",
                        "This request is already being processed. Try again in a moment.",
                        status.HTTP_409_CONFLICT,
                    )
                now = timezone.now()
                record = IdempotencyRecord.objects.filter(user=user, action=action, key=key).first()
                if record is not None and record.expires_at <= now:
                    record.delete()
                    record = None
                if record is not None:
                    if record.request_fingerprint != fingerprint:
                        raise ApiError(
                            "idempotency_key_reused",
                            "This Idempotency-Key was already used for a different request.",
                            status.HTTP_422_UNPROCESSABLE_ENTITY,
                        )
                    return _replay(record)

                response = handler(view, request, *args, **kwargs)
                if not 200 <= response.status_code < 300:
                    transaction.set_rollback(True)
                    return response

                IdempotencyRecord.objects.filter(user=user, expires_at__lte=now).delete()
                IdempotencyRecord.objects.create(
                    user=user,
                    action=action,
                    key=key,
                    request_fingerprint=fingerprint,
                    response_status=response.status_code,
                    # Stored exactly as the client receives it.
                    response_body=json.loads(JSONRenderer().render(response.data))
                    if response.data is not None
                    else None,
                    created_at=now,
                    expires_at=now + idempotency_ttl(),
                )
                return response

        return cast(Handler, wrapper)

    return decorator


def purge_expired(batch_size: int = 1000) -> int:
    """Delete expired records in batches; returns how many were removed."""
    removed = 0
    while True:
        batch = list(
            IdempotencyRecord.objects.filter(expires_at__lte=timezone.now()).values_list("pk", flat=True)[:batch_size]
        )
        if not batch:
            return removed
        removed += IdempotencyRecord.objects.filter(pk__in=batch).delete()[0]
