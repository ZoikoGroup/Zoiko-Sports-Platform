"""Tables of the competitions module: competitions and their events (P5.2, provisional subset).

Built ahead of P5 for venue readiness (P12.1), on the defaults of D-047 until the
company decides GD3 (competition, event and fixture model) and K3 (lifecycles):

- Competition: owned by one organizer organization (`organization`).
- Event: one date of a competition, hosted by one venue organization (`venue`),
  with its place (city, country, region) and IANA time zone. Instants are UTC.

Not built yet (rest of P5): event participation (invited clubs), lifecycle
transitions as data, HTTP endpoints and the second policy gate.
"""

from django.db import models
from django.db.models import Q

from platform_core.models import PlatformModel, VersionedModel

# Choice sets live at module level so each model's Meta can turn them into
# database CHECK constraints (D-046).


class CompetitionStatus(models.TextChoices):
    PLANNED = "planned", "Planned"
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class EventStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class Region(models.TextChoices):
    """Operating regions, the same six the Organizer workspace filters by."""

    NORTH_AMERICA = "north_america", "North America"
    SOUTH_AMERICA = "south_america", "South America"
    EUROPE = "europe", "Europe"
    AFRICA = "africa", "Africa"
    ASIA = "asia", "Asia"
    OCEANIA = "oceania", "Oceania"


class Competition(PlatformModel, VersionedModel):
    Status = CompetitionStatus

    # The organizer organization that runs it.
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="+")
    name = models.CharField(max_length=200)
    sport = models.CharField(max_length=40, help_text="Sport code, e.g. football (reference list: P5.1).")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(status__in=CompetitionStatus.values), name="competition_status_valid"),
            models.CheckConstraint(
                condition=Q(sport__regex=r"^[a-z][a-z0-9_]{1,39}$"), name="competition_sport_format"
            ),
        ]
        indexes = [models.Index(fields=["organization", "status"], name="competition_org_status")]

    @property
    def owner_organization_id(self) -> int:
        """platform_core.authorization.Resource: the organizer owns its competitions."""
        return self.organization_id

    def __str__(self) -> str:
        return self.name


class Event(PlatformModel, VersionedModel):
    Status = EventStatus
    Region = Region

    # No separate index on competition: event_competition_start starts with it.
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="events", db_index=False)
    name = models.CharField(max_length=200)
    # The venue organization hosting it (a venue is an organization: D-047).
    venue = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="+")
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=2, help_text="ISO 3166-1 alpha-2, upper case.")
    region = models.CharField(max_length=20, choices=Region.choices)
    time_zone = models.CharField(max_length=64, help_text="IANA name, e.g. Europe/London.")
    starts_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(status__in=EventStatus.values), name="event_status_valid"),
            models.CheckConstraint(condition=Q(region__in=Region.values), name="event_region_valid"),
            models.CheckConstraint(condition=Q(country__regex=r"^[A-Z]{2}$"), name="event_country_format"),
        ]
        indexes = [models.Index(fields=["competition", "starts_at"], name="event_competition_start")]

    @property
    def owner_organization_id(self) -> int:
        """platform_core.authorization.Resource: the competition's organizer owns its events."""
        return self.competition.organization_id

    def __str__(self) -> str:
        return self.name
