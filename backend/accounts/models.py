from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class AccountType(models.TextChoices):
    """The four sign-in workspaces offered on the login page."""

    ORGANIZATION = "organization", "Organization"
    VENUE = "venue", "Venue"
    CLUB = "club", "Team / Club"
    INDIVIDUAL = "individual", "Individual"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    # Personal (participant/staff) workspace, independent of any organization.
    has_individual_profile = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    def __str__(self):
        return self.email

    def active_memberships(self):
        now = timezone.now()
        return (
            self.memberships.select_related("organization")
            .filter(status=Membership.Status.ACTIVE, organization__status=Organization.Status.ACTIVE)
            .filter(models.Q(valid_from__isnull=True) | models.Q(valid_from__lte=now))
            .filter(models.Q(valid_to__isnull=True) | models.Q(valid_to__gt=now))
        )

    def available_account_types(self) -> list[str]:
        kinds = set(self.active_memberships().values_list("organization__kind", flat=True))
        types = [Organization.KIND_TO_ACCOUNT_TYPE[k] for k in kinds]
        if self.has_individual_profile:
            types.append(AccountType.INDIVIDUAL)
        return [t for t in AccountType.values if t in types]


class Organization(models.Model):
    """A legally distinct party. Membership never implies access to an event."""

    class Kind(models.TextChoices):
        ORGANIZER = "organizer", "Competition organizer"
        VENUE = "venue", "Venue operator"
        CLUB = "club", "Team / club"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    KIND_TO_ACCOUNT_TYPE = {
        Kind.ORGANIZER: AccountType.ORGANIZATION,
        Kind.VENUE: AccountType.VENUE,
        Kind.CLUB: AccountType.CLUB,
    }
    ACCOUNT_TYPE_TO_KIND = {v: k for k, v in KIND_TO_ACCOUNT_TYPE.items()}

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    jurisdiction = models.CharField(max_length=8, blank=True, help_text="ISO 3166 country/subdivision code")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        REVOKED = "revoked", "Revoked"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="unique_membership")]

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"
