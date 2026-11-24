from datetime import datetime
from typing import Any

from django.db import transaction

from platform_core.concurrency import update_versioned

from .models import ReferenceItem


def create_item(owner: Any, *, title: str, starts_at: datetime, time_zone: str, status: str) -> ReferenceItem:
    with transaction.atomic():
        return ReferenceItem.objects.create(
            owner=owner, title=title, starts_at=starts_at, time_zone=time_zone, status=status
        )


def update_item(item: ReferenceItem, *, expected_version: int, changes: dict[str, Any]) -> ReferenceItem:
    with transaction.atomic():
        return update_versioned(item, expected_version, changes)
