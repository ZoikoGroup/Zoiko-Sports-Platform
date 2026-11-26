from django.apps import AppConfig


class OutboxConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "outbox"

    def ready(self) -> None:
        # Delivered events older than OUTBOX_RETENTION_DAYS are removed by the
        # scheduled housekeeping (platform_core.maintenance).
        from platform_core.maintenance import register

        from .services import purge_delivered

        register("outbox.purge_delivered", purge_delivered)
