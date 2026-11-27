from django.apps import AppConfig


class ActivityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "activity"

    def ready(self) -> None:
        # The feed is built by consuming outbox events (P4.4).
        from outbox.services import subscribe

        from .services import CONSUMER, SUBSCRIPTIONS, handle

        subscribe(CONSUMER, SUBSCRIPTIONS, handle)
