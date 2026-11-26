"""One error envelope for every API response.

    {"error": {"code": "...", "message": "...", "request_id": "...", "fields": {...}?, ...extra}}

- `code` is stable and machine-readable (see ERROR_CODES); `message` is safe to
  show to the person using the app; `fields` maps input fields to messages.
- `request_id` is the correlation ID of the request (platform_core.request_context),
  also returned in the X-Request-ID header and present in every log line.
- DRF errors go through `exception_handler` (settings REST_FRAMEWORK). Errors
  raised outside DRF views (unknown URL, CSRF failure, rejected Host header,
  unhandled exception) use the Django handlers below, which answer `/api/`
  paths in the same envelope and leave every other path to Django's defaults.
  Stack traces never reach the response; the server log keeps them.
"""

from typing import Any

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views import csrf as django_csrf
from django.views import defaults as django_defaults
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .request_context import get_request_id

API_PATH_PREFIX = "/api/"

# Codes the platform itself returns. Modules add their own domain codes (for
# example "invitation_expired"); a code, once published, keeps its meaning.
ERROR_CODES: dict[str, str] = {
    "validation_error": "Input failed validation; see `fields`.",
    "bad_request": "The request could not be processed.",
    "parse_error": "The request body is not valid JSON.",
    "not_authenticated": "Sign-in is required.",
    "permission_denied": "The signed-in user may not perform this action.",
    "csrf_failed": "The CSRF token is missing or invalid.",
    "not_found": "The resource does not exist or is not visible to the caller.",
    "method_not_allowed": "The HTTP method is not supported on this URL.",
    "unsupported_media_type": "The request content type is not supported.",
    "not_acceptable": "The requested response format is not available.",
    "rate_limited": "Too many requests; retry after `retry_after` seconds.",
    "version_conflict": "The record changed since the stated version; see `current_version`.",
    "idempotency_key_required": "The Idempotency-Key header is required on this request.",
    "idempotency_key_invalid": "The Idempotency-Key header is malformed.",
    "idempotency_key_reused": "The Idempotency-Key was already used with a different request.",
    "request_in_progress": "A request with this Idempotency-Key is still being processed.",
    "invalid_cursor": "The pagination cursor is malformed or out of date.",
    "invalid_time_zone": "The time zone is not a supported IANA name.",
    "context_required": "The request needs an active workspace context; choose one (PUT /me/context/).",
    "server_error": "An unexpected server error; the request ID identifies it in the logs.",
}

SERVER_ERROR_MESSAGE = "Something went wrong on our side. Please try again."


class ApiError(exceptions.APIException):
    """An API error with a stable code, a user-facing message and optional details."""

    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = status.HTTP_400_BAD_REQUEST,
        fields: dict[str, Any] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = http_status
        self.code = code
        self.message = message
        self.fields = fields
        self.extra = extra
        super().__init__(detail=message, code=code)


def error_body(
    code: str, message: str, *, fields: dict[str, Any] | None = None, extra: dict[str, Any] | None = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    request_id = get_request_id()
    if request_id is not None:
        error["request_id"] = request_id
    if fields:
        error["fields"] = fields
    if extra:
        error.update({key: value for key, value in extra.items() if key not in error})
    return {"error": error}


def error_response(
    code: str,
    message: str,
    http_status: int,
    fields: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> Response:
    """The envelope as a DRF response (inside DRF views)."""
    return Response(error_body(code, message, fields=fields, extra=extra), status=http_status)


def json_error(code: str, message: str, http_status: int, *, extra: dict[str, Any] | None = None) -> JsonResponse:
    """The envelope as a plain Django response (outside DRF)."""
    return JsonResponse(error_body(code, message, extra=extra), status=http_status)


def method_not_allowed(allowed: list[str]) -> JsonResponse:
    response = json_error("method_not_allowed", "This method isn't allowed here.", status.HTTP_405_METHOD_NOT_ALLOWED)
    response["Allow"] = ", ".join(allowed)
    return response


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """DRF exception handler (REST_FRAMEWORK["EXCEPTION_HANDLER"])."""
    if isinstance(exc, ApiError):
        return error_response(exc.code, exc.message, exc.status_code, exc.fields, exc.extra)

    response = drf_exception_handler(exc, context)
    if response is None:
        # Not an API exception: Django's handler500 answers (and logs the traceback).
        return None

    if isinstance(exc, exceptions.ValidationError):
        data = response.data if isinstance(response.data, dict) else {"non_field_errors": response.data}
        fields = {k: [str(m) for m in (v if isinstance(v, list) else [v])] for k, v in data.items()}
        non_field = fields.pop("non_field_errors", None)
        message = non_field[0] if non_field else "Please correct the highlighted fields."
        return error_response("validation_error", message, response.status_code, fields or None)

    if isinstance(exc, exceptions.Throttled):
        wait = int(getattr(exc, "wait", None) or 0)
        message = (
            f"Too many attempts. Please wait {wait} seconds and try again."
            if wait
            else "Too many attempts. Please try again shortly."
        )
        # Keep DRF's response so its Retry-After header survives.
        response.data = error_body("rate_limited", message, extra={"retry_after": wait})
        return response

    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        return error_response("not_authenticated", "You need to sign in to continue.", status.HTTP_401_UNAUTHORIZED)

    if isinstance(exc, exceptions.PermissionDenied):
        code = "csrf_failed" if "CSRF" in str(exc.detail) else "permission_denied"
        message = "Your session expired. Refresh the page and try again." if code == "csrf_failed" else str(exc.detail)
        return error_response(code, message, response.status_code)

    detail = response.data.get("detail", "Request failed.") if isinstance(response.data, dict) else "Request failed."
    code = getattr(exc, "default_code", "error")
    # Keep headers DRF set (for example Allow on 405).
    response.data = error_body(code, str(detail))
    return response


# --- Django-level handlers (config/urls.py handler400/403/404/500, CSRF_FAILURE_VIEW) ---


def _is_api(request: HttpRequest) -> bool:
    return request.path_info.startswith(API_PATH_PREFIX)


def bad_request(request: HttpRequest, exception: Exception) -> HttpResponse:
    if _is_api(request):
        return json_error("bad_request", "The request could not be processed.", status.HTTP_400_BAD_REQUEST)
    return django_defaults.bad_request(request, exception)


def permission_denied(request: HttpRequest, exception: Exception) -> HttpResponse:
    if _is_api(request):
        return json_error("permission_denied", "You don't have permission to do this.", status.HTTP_403_FORBIDDEN)
    return django_defaults.permission_denied(request, exception)


def not_found(request: HttpRequest, exception: Exception) -> HttpResponse:
    if _is_api(request):
        return json_error("not_found", "Not found.", status.HTTP_404_NOT_FOUND)
    return django_defaults.page_not_found(request, exception)


def server_error(request: HttpRequest) -> HttpResponse:
    if _is_api(request):
        return json_error("server_error", SERVER_ERROR_MESSAGE, status.HTTP_500_INTERNAL_SERVER_ERROR)
    return django_defaults.server_error(request)


def csrf_failure(request: HttpRequest, reason: str = "") -> HttpResponse:
    if _is_api(request):
        return json_error(
            "csrf_failed", "Your session expired. Refresh the page and try again.", status.HTTP_403_FORBIDDEN
        )
    return django_csrf.csrf_failure(request, reason)
