"""Tables of the outbox: published events and their per-consumer deliveries (P4.1).

- OutboxEvent: one domain event, written in the same transaction as the change
  it describes, so a committed change always has its event and a rolled-back one
  never does.
- Delivery: one row per (event, consumer), created with the event. The worker
  (`manage.py outbox worker`) runs the consumer and marks the delivery done in
  one transaction, so each consumer's effect happens exactly once even if the
  worker crashes; failures retry with backoff and end as "dead" (replayable).
"""

import uuid

from django.db import models
from django.db.models import Q

# Same rule as platform_core.events.NAME_PATTERN, enforced by the database too (D-046).
EVENT_NAME_FORMAT = r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$"


class DeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    DONE = "done", "Done"
    DEAD = "dead", "Dead (gave up; replayable)"


class OutboxEvent(models.Model):
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    # Event type name and schema version (platform_core.events.EventType).
    type = models.CharField(max_length=120)
    version = models.PositiveSmallIntegerField()
    aggregate_type = models.CharField(max_length=60)
    aggregate_id = models.CharField(max_length=64)
    aggregate_version = models.PositiveIntegerField(null=True, blank=True)
    # Visibility scope: the organization (public UUID) the event belongs to.
    organization_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField()
    occurred_at = models.DateTimeField()
    request_id = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["type", "version"], name="outbox_event_type"),
            models.Index(fields=["occurred_at"], name="outbox_event_time"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(type__regex=EVENT_NAME_FORMAT), name="outbox_event_type_format"),
            models.CheckConstraint(condition=Q(version__gte=1), name="outbox_event_version_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.type}.v{self.version} {self.event_id}"


class Delivery(models.Model):
    Status = DeliveryStatus

    # No separate index on event: one_delivery_per_consumer (event, consumer) already starts with it.
    event = models.ForeignKey(OutboxEvent, on_delete=models.CASCADE, related_name="deliveries", db_index=False)
    consumer = models.CharField(max_length=120)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    available_at = models.DateTimeField()
    last_error = models.TextField(blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "consumer"], name="one_delivery_per_consumer"),
            models.CheckConstraint(condition=Q(status__in=DeliveryStatus.values), name="outbox_delivery_status_valid"),
            # A done delivery records when it was delivered.
            models.CheckConstraint(
                condition=~Q(status="done") | Q(delivered_at__isnull=False), name="outbox_delivery_done_has_time"
            ),
        ]
        indexes = [
            # The worker's queue: due pending deliveries, oldest first.
            models.Index(
                fields=["available_at", "id"],
                name="outbox_delivery_due",
                condition=models.Q(status="pending"),
            ),
            models.Index(fields=["status", "consumer"], name="outbox_delivery_status"),
        ]

    def __str__(self) -> str:
        return f"{self.event_id} → {self.consumer} ({self.status})"
