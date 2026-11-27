"""Tables of the organizations module: organizations, memberships and invitations.

Organizations and memberships moved here from `accounts` in P2 (migration
accounts 0003 renamed the tables; rows and primary keys are unchanged).

- Organization: a legally distinct party (organizer, venue operator or club).
  New organizations start PENDING and grant nothing until Zoiko verifies them.
- Membership: a person's role (from the access catalogue) in one organization. Only an ACTIVE membership in
  an ACTIVE organization, inside its validity window, yields a workspace context.
  Membership never implies access to an event (that is event participation).
- Invitation: the only way to join an organization. The emailed token is stored
  as a SHA-256 hash; it is single-use and expires.
"""

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower

from platform_core.models import PlatformModel

# Choice sets live at module level so each model's Meta can turn them into database
# CHECK constraints; the models expose them as Organization.Kind, Membership.Status, …


class OrganizationKind(models.TextChoices):
    ORGANIZER = "organizer", "Competition organizer"
    VENUE = "venue", "Venue operator"
    CLUB = "club", "Team / club"


class OrganizationStatus(models.TextChoices):
    PENDING = "pending", "Pending verification"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"


class MembershipStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    REVOKED = "revoked", "Revoked"


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REVOKED = "revoked", "Revoked"


class Organization(PlatformModel):
    """A legally distinct party. Membership never implies access to an event."""

    Kind = OrganizationKind
    Status = OrganizationStatus

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    jurisdiction = models.CharField(max_length=8, blank=True, help_text="ISO 3166 country/subdivision code")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # The database refuses values the application would never write (D-046).
        constraints = [
            models.CheckConstraint(condition=Q(kind__in=OrganizationKind.values), name="organization_kind_valid"),
            models.CheckConstraint(condition=Q(status__in=OrganizationStatus.values), name="organization_status_valid"),
            # An active organization has been verified (reinstating never activates an unverified one).
            models.CheckConstraint(
                condition=~Q(status="active") | Q(verified_at__isnull=False), name="organization_active_is_verified"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Membership(PlatformModel):
    Status = MembershipStatus

    # No separate index on user: unique_membership (user, organization) already starts with it.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships", db_index=False
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    # A role from the catalogue (access.Role), stored by its code: `role_id` is the code.
    # Not indexed: nothing looks memberships up by role (the foreign key still guards it).
    role = models.ForeignKey(
        "access.Role",
        to_field="code",
        db_column="role",
        on_delete=models.PROTECT,
        related_name="+",
        db_index=False,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="unique_membership"),
            models.CheckConstraint(condition=Q(status__in=MembershipStatus.values), name="membership_status_valid"),
            models.CheckConstraint(
                condition=Q(valid_from__isnull=True) | Q(valid_to__isnull=True) | Q(valid_to__gt=F("valid_from")),
                name="membership_validity_window_ordered",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization} ({self.role_id})"


class Invitation(PlatformModel):
    Status = InvitationStatus

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    # Lower-cased; the invitation can be accepted only by the account with this address.
    email = models.EmailField()
    role = models.ForeignKey(
        "access.Role",
        to_field="code",
        db_column="role",
        on_delete=models.PROTECT,
        related_name="+",
        db_index=False,
    )
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
            ),
            models.CheckConstraint(condition=Q(status__in=InvitationStatus.values), name="invitation_status_valid"),
            models.CheckConstraint(condition=Q(email=Lower("email")), name="invitation_email_lowercase"),
            # Each final state records when it was reached.
            models.CheckConstraint(
                condition=~Q(status="accepted") | Q(accepted_at__isnull=False), name="invitation_accepted_has_time"
            ),
            models.CheckConstraint(
                condition=~Q(status="revoked") | Q(revoked_at__isnull=False), name="invitation_revoked_has_time"
            ),
        ]

    def __str__(self) -> str:
        return f"Invitation to {self.organization} ({self.role_id}, {self.status})"
