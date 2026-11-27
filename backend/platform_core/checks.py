"""System checks for the platform conventions (run by `manage.py check`, CI included)."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from django.apps import AppConfig, apps
from django.conf import settings
from django.core.checks import CheckMessage, Error, register
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.views import APIView

from .boundaries import find_violations

API_ROUTE_PREFIX = "api/"


def local_modules() -> list[str]:
    """Top-level packages of the installed apps that live in this repository."""
    base_dir = Path(settings.BASE_DIR).resolve()
    names: set[str] = set()
    config: AppConfig
    for config in apps.get_app_configs():
        path = Path(config.path).resolve()
        if base_dir in path.parents and "site-packages" not in path.parts and ".venv" not in path.parts:
            names.add(config.name.split(".")[0])
    return sorted(names)


@register("architecture")
def check_module_boundaries(app_configs: Any = None, **kwargs: Any) -> list[CheckMessage]:
    return [
        Error(
            violation.message,
            hint="Import the other module's services, selectors or events instead (platform_core/boundaries.py).",
            id="platform_core.E001",
        )
        for violation in find_violations(Path(settings.BASE_DIR), local_modules())
    ]


def iter_routes(
    patterns: list[URLPattern | URLResolver] | None = None, prefix: str = ""
) -> Iterator[tuple[str, URLPattern]]:
    """(route, pattern) for every endpoint of the URL configuration, nested includes resolved."""
    for entry in get_resolver().url_patterns if patterns is None else patterns:
        route = prefix + str(entry.pattern)
        if isinstance(entry, URLResolver):
            yield from iter_routes(entry.url_patterns, route)
        else:
            yield route, entry


def declares_permissions(view_class: type[APIView]) -> bool:
    """Whether project code (not DRF's defaults) states the view's permission rule."""
    for cls in view_class.__mro__:
        if cls.__module__.startswith(("rest_framework.", "django.")):
            break
        if "permission_classes" in vars(cls) or "get_permissions" in vars(cls):
            return True
    return False


def unprotected_api_routes() -> list[str]:
    """API routes whose view states no permission rule of its own (deny by default, P3.6)."""
    missing: list[str] = []
    for route, pattern in iter_routes():
        if not route.startswith(API_ROUTE_PREFIX):
            continue
        callback = pattern.callback
        view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
        if isinstance(view_class, type) and issubclass(view_class, APIView):
            if view_class.__module__.startswith("drf_spectacular.") or declares_permissions(view_class):
                continue
        elif getattr(callback, "public_endpoint", False):
            continue
        missing.append(route)
    return missing


@register("security")
def check_api_permissions(app_configs: Any = None, **kwargs: Any) -> list[CheckMessage]:
    return [
        Error(
            f"/{route} states no permission rule of its own.",
            hint=(
                "Set permission_classes on the view (Public for anonymous endpoints, RequirePermission(...) "
                "for workspace actions), or mark a plain Django view with @public_endpoint "
                "(platform_core/authorization.py)."
            ),
            id="platform_core.E002",
        )
        for route in unprotected_api_routes()
    ]
