"""One error envelope for every API response: {"error": {code, message, fields?}}."""

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(exceptions.APIException):
    def __init__(self, code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST, fields=None):
        self.status_code = http_status
        self.code = code
        self.message = message
        self.fields = fields
        super().__init__(detail=message, code=code)


def error_response(code: str, message: str, http_status: int, fields=None) -> Response:
    body = {"error": {"code": code, "message": message}}
    if fields:
        body["error"]["fields"] = fields
    return Response(body, status=http_status)


def exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return error_response(exc.code, exc.message, exc.status_code, exc.fields)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, exceptions.ValidationError):
        fields = {k: [str(m) for m in (v if isinstance(v, list) else [v])] for k, v in response.data.items()}
        non_field = fields.pop("non_field_errors", None)
        message = non_field[0] if non_field else "Please correct the highlighted fields."
        return error_response("validation_error", message, response.status_code, fields or None)

    if isinstance(exc, exceptions.Throttled):
        wait = int(exc.wait or 0)
        response.data = {
            "error": {
                "code": "rate_limited",
                "message": f"Too many attempts. Please wait {wait} seconds and try again." if wait else
                "Too many attempts. Please try again shortly.",
                "retry_after": wait,
            }
        }
        return response

    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        return error_response("not_authenticated", "You need to sign in to continue.", status.HTTP_401_UNAUTHORIZED)

    if isinstance(exc, exceptions.PermissionDenied):
        code = "csrf_failed" if "CSRF" in str(exc.detail) else "permission_denied"
        message = "Your session expired. Refresh the page and try again." if code == "csrf_failed" else str(exc.detail)
        return error_response(code, message, response.status_code)

    detail = response.data.get("detail", "Request failed.") if isinstance(response.data, dict) else "Request failed."
    return error_response(getattr(exc, "default_code", "error"), str(detail), response.status_code)
