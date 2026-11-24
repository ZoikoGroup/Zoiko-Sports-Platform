"""OpenAPI building blocks for the platform conventions (drf-spectacular).

Modules describe their operations with @extend_schema and reuse these pieces so
that the error envelope, the 409 conflict body and the Idempotency-Key header
read the same everywhere:

    @extend_schema(
        request=CompetitionCreate,
        responses={201: Competition, **error_responses(400, 401, 403, 409, 422, 429)},
        parameters=[IDEMPOTENCY_KEY_PARAMETER],
    )
"""

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse
from rest_framework import serializers

from .idempotency import IDEMPOTENCY_HEADER


class ErrorDetailSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Stable, machine-readable error code.")
    message = serializers.CharField(help_text="Message that is safe to show to the user.")
    request_id = serializers.CharField(help_text="Correlation ID of the request (also in X-Request-ID).")
    # The envelope's key is "fields"; DRF's metaclass moves declared fields off the
    # class, so this does not shadow Serializer.fields at runtime.
    fields = serializers.DictField(  # type: ignore[assignment]
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        help_text="Messages per input field, when the error concerns specific fields.",
    )


class ErrorSerializer(serializers.Serializer):
    error = ErrorDetailSerializer()


class VersionConflictDetailSerializer(ErrorDetailSerializer):
    current_version = serializers.IntegerField(help_text="The version currently stored.")


class VersionConflictSerializer(serializers.Serializer):
    error = VersionConflictDetailSerializer()


class RateLimitedDetailSerializer(ErrorDetailSerializer):
    retry_after = serializers.IntegerField(help_text="Seconds to wait before retrying.")


class RateLimitedSerializer(serializers.Serializer):
    error = RateLimitedDetailSerializer()


_DESCRIPTIONS = {
    400: "Invalid request (validation_error, invalid_cursor, idempotency_key_required, ...).",
    401: "Sign-in required (not_authenticated).",
    403: "Not allowed (permission_denied, csrf_failed, or a module-specific code).",
    404: "Not found, or not visible to the caller (not_found).",
    409: "Conflict (version_conflict with current_version, or request_in_progress).",
    422: "The Idempotency-Key was already used for a different request (idempotency_key_reused).",
    429: "Too many requests (rate_limited with retry_after).",
    501: "Not implemented in this environment.",
    503: "Temporarily unavailable.",
}


def error_responses(*statuses: int) -> dict[int, OpenApiResponse]:
    """Documented error responses in the platform envelope, keyed by status code."""
    responses: dict[int, OpenApiResponse] = {}
    for code in statuses:
        if code == 409:
            serializer: type[serializers.Serializer] = VersionConflictSerializer
        elif code == 429:
            serializer = RateLimitedSerializer
        else:
            serializer = ErrorSerializer
        responses[code] = OpenApiResponse(response=serializer, description=_DESCRIPTIONS.get(code, "Error."))
    return responses


IDEMPOTENCY_KEY_PARAMETER = OpenApiParameter(
    name=IDEMPOTENCY_HEADER,
    type=str,
    location=OpenApiParameter.HEADER,
    required=True,
    description=(
        "A new unique value (for example a UUID) per submission. Retrying with the same key returns the "
        "original response (with Idempotent-Replayed: true) instead of acting twice."
    ),
)
