"""Tables of the readiness module: venue readiness for events (P12.1).

- VenueReadiness: one venue's readiness for one event. The event's organizer owns
  it for permission purposes (it reviews it); the venue fills it in.
- ReadinessCheck: one item of the venue's checklist. `shared` says whether the
  organizer may see it: the venue decides, and nothing unshared ever leaves the
  readiness module's reads (golden event: 16 checks, 14 shared). `critical`
  checks raise high-severity attention items. States (K5, D-047): open →
  submitted → accepted, or changes_requested back to the venue.
- ReadinessEvidence: something the venue submitted for a check. Records only;
  file upload and malware scanning come with the storage decision (GI3, P12.8).
- UpdateRequest: an organizer asked the venue to update its readiness.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from platform_core.models import PlatformModel

# Choice sets live at module level so Meta can turn them into CHECK constraints (D-046).


class CheckState(models.TextChoices):
    OPEN = "open", "Open"
    SUBMITTED = "submitted", "Submitted"
    ACCEPTED = "accepted", "Accepted"
    CHANGES_REQUESTED = "changes_requested", "Changes requested"


REVIEWED_STATES = [CheckState.ACCEPTED, CheckState.CHANGES_REQUESTED]


class VenueReadiness(PlatformModel):
    # No separate index on event: unique_readiness_per_venue (event, venue) starts with it.
    event = models.ForeignKey("competitions.Event", on_delete=models.CASCADE, related_name="+", db_index=False)
    venue = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="+")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "venue"], name="unique_readiness_per_venue")]

    @property
    def owner_organization_id(self) -> int:
        """platform_core.authorization.Resource: the event's organizer reviews (owns) it."""
        return self.event.competition.organization_id

    def __str__(self) -> str:
        return f"{self.venue} for {self.event}"


class ReadinessCheck(PlatformModel):
    State = CheckState

    # No separate index on readiness: unique_check_position (readiness, position) starts with it.
    readiness = models.ForeignKey(VenueReadiness, on_delete=models.CASCADE, related_name="checks", db_index=False)
    position = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200)
    state = models.CharField(max_length=20, choices=State.choices, default=State.OPEN)
    shared = models.BooleanField(default=True, help_text="Visible to the event's organizer.")
    critical = models.BooleanField(default=False, help_text="Safety-critical: problems are high severity.")
    due_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # The reviewer's reason when changes are requested (shown to both sides).
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["readiness", "position"], name="unique_check_position"),
            models.CheckConstraint(condition=Q(state__in=CheckState.values), name="readiness_check_state_valid"),
            # Submitted means it has a time; reviewed states have both times.
            models.CheckConstraint(
                condition=Q(state=CheckState.OPEN) | Q(submitted_at__isnull=False),
                name="readiness_check_submitted_has_time",
            ),
            models.CheckConstraint(
                condition=~Q(state__in=REVIEWED_STATES) | Q(reviewed_at__isnull=False),
                name="readiness_check_reviewed_has_time",
            ),
        ]

    def __str__(self) -> str:
        return self.title


class ReadinessEvidence(PlatformModel):
    check_item = models.ForeignKey(ReadinessCheck, on_delete=models.CASCADE, related_name="evidence")
    title = models.CharField(max_length=200)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    def __str__(self) -> str:
        return self.title


class UpdateRequest(PlatformModel):
    readiness = models.ForeignKey(VenueReadiness, on_delete=models.CASCADE, related_name="update_requests")
    message = models.CharField(max_length=500)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    # The organizer organization that asked (from the workspace context).
    requested_by_organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="+"
    )

    def __str__(self) -> str:
        return f"Update requested for {self.readiness}"
