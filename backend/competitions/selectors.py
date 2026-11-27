"""Read operations of the competitions module (the public read interface).

Nothing is listed through HTTP yet (P5.6). Venue readiness reaches events through
its own foreign key and scopes them with access.selectors.scope_to_context.
"""

from uuid import UUID

from .models import Event


def event_names(public_ids: list[str]) -> dict[str, str]:
    """Display names by event public UUID (as strings); unknown IDs are left out (consumers' lookups)."""
    valid = []
    for value in public_ids:
        try:
            valid.append(UUID(str(value)))
        except ValueError:
            continue
    return {
        str(public_id): name
        for public_id, name in Event.objects.filter(public_id__in=valid).values_list("public_id", "name")
    }
