"""System checks for the platform conventions (run by `manage.py check`, CI included)."""

from pathlib import Path
from typing import Any

from django.apps import AppConfig, apps
from django.conf import settings
from django.core.checks import CheckMessage, Error, register

from .boundaries import find_violations


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
            hint="Import the other module's services or selectors instead (platform_core/boundaries.py).",
            id="platform_core.E001",
        )
        for violation in find_violations(Path(settings.BASE_DIR), local_modules())
    ]
