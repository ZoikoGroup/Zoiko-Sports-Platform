from django.apps import AppConfig


class PlatformCoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "platform_core"
    verbose_name = "Platform core"

    def ready(self) -> None:
        # Registers the system checks (module boundaries).
        from . import checks  # noqa: F401
