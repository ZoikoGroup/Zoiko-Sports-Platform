"""Optimistic concurrency for VersionedModel records.

Every edit states the version it was based on (the API takes it in the request
body as `version`). The check and the change happen in one UPDATE statement,

    UPDATE ... SET ..., version = version + 1 WHERE id = %s AND version = %s

so two concurrent edits from the same version can never both succeed: the
second finds no matching row and gets 409 `version_conflict`, with the current
version so the client can reload. No row locks are held between read and write.
"""

from typing import Any

from django.db.models import F
from django.utils import timezone
from rest_framework import serializers, status

from .errors import ApiError
from .models import VersionedModel

# Managed by the platform; never changed through update_versioned.
PROTECTED_FIELDS = frozenset({"id", "pk", "public_id", "version", "created_at", "updated_at"})


class VersionConflict(ApiError):
    def __init__(self, current_version: int) -> None:
        super().__init__(
            "version_conflict",
            "This changed since you opened it. Reload to see the latest version.",
            status.HTTP_409_CONFLICT,
            extra={"current_version": current_version},
        )


class RecordGone(ApiError):
    def __init__(self) -> None:
        super().__init__("not_found", "Not found.", status.HTTP_404_NOT_FOUND)


class VersionField(serializers.IntegerField):
    """The `version` an edit is based on (required, positive)."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("min_value", 1)
        kwargs.setdefault("help_text", "The version this change is based on; a newer stored version returns 409.")
        super().__init__(**kwargs)


def update_versioned[V: VersionedModel](instance: V, expected_version: int, changes: dict[str, Any]) -> V:
    """Apply `changes` if the stored version still equals `expected_version`.

    Returns the instance with the changes and the new version applied. Raises
    VersionConflict (409) when the record moved on, RecordGone (404) when it no
    longer exists. Call it inside the caller's transaction when other writes
    must commit or roll back together with it.
    """
    protected = PROTECTED_FIELDS.intersection(changes)
    if protected:
        raise ValueError(f"Platform-managed fields cannot be changed: {sorted(protected)}")
    if not changes:
        raise ValueError("update_versioned needs at least one field to change.")

    model = type(instance)
    now = timezone.now()
    values: dict[str, Any] = {**changes, "version": F("version") + 1}
    if any(field.name == "updated_at" for field in model._meta.concrete_fields):
        values["updated_at"] = now

    updated = model._default_manager.filter(pk=instance.pk, version=expected_version).update(**values)
    if updated == 0:
        current = model._default_manager.filter(pk=instance.pk).values_list("version", flat=True).first()
        if current is None:
            raise RecordGone()
        raise VersionConflict(current)

    for name, value in changes.items():
        setattr(instance, name, value)
    instance.version = expected_version + 1
    if "updated_at" in values:
        instance.updated_at = now  # type: ignore[attr-defined]
    return instance
