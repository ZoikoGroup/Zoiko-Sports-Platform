"""Base record conventions and the platform's own tables.

Domain models build on the abstract classes:

    class Competition(PlatformModel, VersionedModel): ...

- PublicIdModel: `public_id`, a random UUID used in URLs and API responses
  (exposed as "id"). The integer primary key stays internal for joins.
- TimestampedModel: timezone-aware `created_at` / `updated_at`.
- VersionedModel: `version`, starting at 1, increased only by
  platform_core.concurrency.update_versioned (optimistic concurrency).
"""

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone


class PublicIdModel(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PlatformModel(PublicIdModel, TimestampedModel):
    """Public UUID plus timestamps: the base for every record exposed through the API."""

    class Meta:
        abstract = True


class VersionedSaveError(RuntimeError):
    """An existing versioned record was saved directly instead of through update_versioned."""


class VersionedModel(models.Model):
    version = models.PositiveIntegerField(default=1, editable=False)

    class Meta:
        abstract = True

    def save(self, *args: Any, **kwargs: Any) -> None:
        # Creating is allowed; changing an existing row must state the version it
        # was based on, which only update_versioned does.
        if not self._state.adding:
            raise VersionedSaveError(
                f"{type(self).__name__} is versioned: change it with platform_core.concurrency.update_versioned()."
            )
        super().save(*args, **kwargs)


class IdempotencyRecord(models.Model):
    """The stored outcome of a request made with an Idempotency-Key (platform_core.idempotency)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    action = models.CharField(max_length=100)
    key = models.CharField(max_length=255)
    request_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField()
    response_body = models.JSONField(null=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "action", "key"], name="unique_idempotency_key"),
        ]
        indexes = [models.Index(fields=["expires_at"], name="idempotency_expires_idx")]

    def __str__(self) -> str:
        return f"{self.action} ({self.key})"
