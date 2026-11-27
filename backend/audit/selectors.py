"""Reading the audit trail (the audit module's public read interface).

The trail is restricted: only operators (`manage.py audit`) and, from P12.4, the
Reports module behind the `audit.view` permission read it.
"""

from typing import Any

from django.db.models import QuerySet

from .models import AuditEntry


def entries(
    *, action: str | None = None, actor_id: Any = None, organization_id: Any = None, limit: int | None = None
) -> QuerySet[AuditEntry]:
    """Newest first, optionally narrowed."""
    queryset = AuditEntry.objects.all()
    if action:
        queryset = queryset.filter(action=action)
    if actor_id:
        queryset = queryset.filter(actor_id=actor_id)
    if organization_id:
        queryset = queryset.filter(organization_id=organization_id)
    return queryset[:limit] if limit else queryset
