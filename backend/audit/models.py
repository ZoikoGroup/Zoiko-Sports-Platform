"""The audit trail: one append-only row per security-relevant action (P3.7).

Fields follow FSD §13: actor, acting organization, role at the time, action,
target, before/after version, outcome, correlation ID and UTC time. Rows are
never updated or deleted: a database trigger (migration 0002) rejects UPDATE
and DELETE, whatever code or tool issues them.

Only identifiers are stored (public UUIDs, codes), never emails, names, tokens
or passwords; `details` holds small, non-personal facts. The trail is the
restricted compliance record; the readable, permission-scoped feed members see
is the activity module.
"""

from django.db import models
from django.db.models import Q


class AuditOutcome(models.TextChoices):
    SUCCESS = "success", "Success"
    DENIED = "denied", "Denied"
    FAILED = "failed", "Failed"


# Same rule as audit.services.ACTION_PATTERN, enforced by the database too (D-046).
ACTION_FORMAT = r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$"


class AuditEntry(models.Model):
    Outcome = AuditOutcome

    occurred_at = models.DateTimeField(db_index=True)
    # Dotted action code, e.g. auth.sign_in, invitation.accepted.
    action = models.CharField(max_length=80)
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.SUCCESS)
    # Public UUID of the acting user; null for anonymous or system actions.
    actor_id = models.UUIDField(null=True, blank=True)
    # The workspace the actor was acting in (organization public UUID) and their role code then.
    organization_id = models.UUIDField(null=True, blank=True)
    role = models.CharField(max_length=60, blank=True)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    before_version = models.PositiveIntegerField(null=True, blank=True)
    after_version = models.PositiveIntegerField(null=True, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["organization_id", "-occurred_at"], name="audit_org_time"),
            models.Index(fields=["actor_id", "-occurred_at"], name="audit_actor_time"),
            models.Index(fields=["action", "-occurred_at"], name="audit_action_time"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(outcome__in=AuditOutcome.values), name="audit_outcome_valid"),
            models.CheckConstraint(condition=Q(action__regex=ACTION_FORMAT), name="audit_action_format"),
        ]

    def __str__(self) -> str:
        return f"{self.occurred_at:%Y-%m-%dT%H:%M:%SZ} {self.action} {self.outcome}"
