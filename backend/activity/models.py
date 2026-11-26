"""The activity feed: short, readable lines generated from events (P4.4).

"Casey Club joined Club A as Club coordinator." Each entry is built by the
`activity.feed` consumer from one outbox event and copies that event's
visibility scope (the organization it concerns), so an organization that is not
involved never sees it. `event_id` is unique: a duplicated or replayed event can
never create a second entry.

The feed is the friendly view members see; the audit trail (audit module) is the
restricted compliance record. They are kept apart on purpose.
"""

from django.db import models

from platform_core.models import PlatformModel


class ActivityEntry(PlatformModel):
    # The outbox event this entry was built from (idempotency key).
    event_id = models.UUIDField(unique=True)
    # Visibility scope: the organization (public UUID) whose members may see it.
    organization_id = models.UUIDField()
    occurred_at = models.DateTimeField()
    # Event type, e.g. invitation.accepted.
    kind = models.CharField(max_length=120)
    summary = models.CharField(max_length=300)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [models.Index(fields=["organization_id", "-occurred_at"], name="activity_org_time")]

    def __str__(self) -> str:
        return self.summary
