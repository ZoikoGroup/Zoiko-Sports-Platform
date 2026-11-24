from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from .models import ReferenceItem


def items_for(owner: Any, *, q: str = "", status: str | None = None) -> QuerySet[ReferenceItem]:
    """Only the caller's own items: every read starts from the rows the actor may see."""
    items = ReferenceItem.objects.filter(owner=owner)
    if q:
        items = items.filter(title__icontains=q)
    if status:
        items = items.filter(status=status)
    return items


def item_for(owner: Any, public_id: UUID) -> ReferenceItem | None:
    return ReferenceItem.objects.filter(owner=owner, public_id=public_id).first()
