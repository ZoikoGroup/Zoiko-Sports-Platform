"""Tables of the organizations module: organizations, memberships and invitations.

Organizations and memberships moved here from `accounts` in P2 (migration
accounts 0003 renamed the tables; rows and primary keys are unchanged).

- Organization: a legally distinct party (organizer, venue operator or club).
  New organizations start PENDING and grant nothing until Zoiko verifies them.
- Membership: a person's role in one organization. Only an ACTIVE membership in
  an ACTIVE organization, inside its validity window, yields a workspace context.
  Membership never implies access to an event (that is event participation).
- Invitation: the only way to join an organization. The emailed token is stored
  as a SHA-256 hash; it is single-use and expires.
"""

from django.conf import settings
from django.db import models

from platform_core.models import PlatformModel


class Organization(PlatformModel):
    """A legally distinct party. Membership never implies access to an event."""

    class Kind(models.TextChoices):
        ORGANIZER = "organizer", "Competition organizer"
        VENUE = "venue", "Venue operator"
        CLUB = "club", "Team / club"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending verification"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    jurisdiction = models.CharField(max_length=8, blank=True, help_text="ISO 3166 country/subdivision code")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.name


class Membership(PlatformModel):
    class Status(models.TextChoices):
        # Kept for rows created before invitations became their own table.
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        REVOKED = "revoked", "Revoked"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="unique_membership")]

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization} ({self.role})"


class Invitation(PlatformModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    # Lower-cased; the invitation can be accepted only by the account with this address.
    email = models.EmailField()
    role = models.CharField(max_length=60)
    # SHA-256 of the emailed token (hex). The token itself is never stored.
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # Re-inviting replaces the earlier pending invitation (services.create_invitation).
            models.UniqueConstraint(
                fields=["organization", "email"],
                condition=models.Q(status="pending"),
                name="one_pending_invitation_per_email",
            )
        ]

    def __str__(self) -> str:
        return f"Invitation to {self.organization} ({self.role}, {self.status})"
