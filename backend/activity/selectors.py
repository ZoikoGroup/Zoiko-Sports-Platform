"""Reading the activity feed (the activity module's public read interface).

Every read starts from access.selectors.scope_to_context: an organization sees
only entries scoped to itself (P3.3). From P5, entries about an event will also
be visible to organizations taking part in it.
"""

from django.db.models import QuerySet

from access.selectors import scope_to_context
from platform_core.workspace import WorkspaceContext

from .models import ActivityEntry


def feed_for(context: WorkspaceContext | None) -> QuerySet[ActivityEntry]:
    """Entries the context may see, newest first."""
    queryset = ActivityEntry.objects.order_by("-occurred_at", "-id")
    return scope_to_context(queryset, context, owner_field="organization_id", by_public_id=True)


def latest_for(context: WorkspaceContext | None, limit: int = 3) -> list[ActivityEntry]:
    """The newest entries (the "Recent Updates" sections of screen endpoints, from P5)."""
    return list(feed_for(context)[:limit])
