from django.conf import settings
from django.db import models

from platform_core.models import PlatformModel, VersionedModel


class ReferenceItem(PlatformModel, VersionedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    starts_at = models.DateTimeField()
    time_zone = models.CharField(max_length=64)

    # Declared explicitly: type checking runs without this test-only app installed.
    objects: models.Manager["ReferenceItem"] = models.Manager()

    class Meta:
        app_label = "kernel_reference"
        indexes = [models.Index(fields=["owner", "-created_at", "-id"], name="reference_owner_created_idx")]

    def __str__(self) -> str:
        return self.title
