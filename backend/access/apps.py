from django.apps import AppConfig


class AccessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "access"

    def ready(self) -> None:
        # Plug the policy engine into the kernel's authorization hooks (deny-all until now).
        from platform_core.authorization import set_permission_checker

        from .selectors import can

        set_permission_checker(can)
