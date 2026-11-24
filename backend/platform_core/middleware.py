"""Platform middleware: request correlation IDs and health probes.

RequestContextMiddleware runs first, so every response (probes and errors
included) carries X-Request-ID and every log line written while handling the
request carries the same `request_id`.

HealthCheckMiddleware serves the health probes before any other middleware.
Container and load-balancer probes call the API by IP address (Docker's health
check uses http://127.0.0.1:8000), not by the public host name. Django rejects a
Host header that is not in ALLOWED_HOSTS with 400, so in a deployment where
ALLOWED_HOSTS lists only the real domain, every probe would fail and the
instance would never become healthy.

The probes reveal nothing but check states and never use the Host header, so
they are answered before host validation runs. Every other URL still goes
through the full middleware stack, including host validation.
"""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.urls import reverse

from . import health
from .request_context import REQUEST_ID_HEADER, request_context

PROBE_VIEWS: dict[str, Callable[[HttpRequest], HttpResponse]] = {
    "health-live": health.live,
    "health-ready": health.ready,
}


class RequestContextMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        with request_context(request.headers.get(REQUEST_ID_HEADER)) as request_id:
            request.request_id = request_id  # type: ignore[attr-defined]
            response = self.get_response(request)
            response[REQUEST_ID_HEADER] = request_id
            return response


class HealthCheckMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        # Paths come from the URL configuration, so the routes stay the single source of truth.
        self._probes: dict[str, Callable[[HttpRequest], HttpResponse]] | None = None

    def _probe_for(self, path: str) -> Callable[[HttpRequest], HttpResponse] | None:
        if self._probes is None:
            self._probes = {reverse(name): view for name, view in PROBE_VIEWS.items()}
        return self._probes.get(path)

    def __call__(self, request: HttpRequest) -> HttpResponse:
        probe = self._probe_for(request.path_info)
        if probe is not None:
            return probe(request)
        return self.get_response(request)
