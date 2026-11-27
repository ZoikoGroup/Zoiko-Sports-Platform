from django.apps import AppConfig
from django.utils.module_loading import autodiscover_modules


class PlatformCoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "platform_core"
    verbose_name = "Platform core"

    def ready(self) -> None:
        # Registers the system checks (module boundaries, deny-by-default API permissions).
        from . import checks  # noqa: F401

        # Imports every installed module's events.py, so all event types are registered
        # (platform_core.events) before anything publishes or the catalogue is written.
        autodiscover_modules("events")

        # The kernel's own housekeeping (platform_core.maintenance).
        from . import maintenance

        maintenance.register("sessions.clear_expired", maintenance.clear_expired_sessions)
        maintenance.register("idempotency.purge_expired", maintenance.purge_idempotency_records)
