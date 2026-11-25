import uuid
from typing import TYPE_CHECKING

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

if TYPE_CHECKING:
    # The stubs make the manager generic over its model; at runtime it is not.
    _UserManagerBase = BaseUserManager["User"]
else:
    _UserManagerBase = BaseUserManager


class AccountType(models.TextChoices):
    """The four workspaces. On the sign-in page the choice is a preference, never a grant:
    the server decides from the account's verified memberships (organizations.selectors)."""

    ORGANIZATION = "organization", "Organization"
    VENUE = "venue", "Venue"
    CLUB = "club", "Team / Club"
    INDIVIDUAL = "individual", "Individual"


class UserManager(_UserManagerBase):
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
    # Random identifier used in API responses; the integer key stays internal.
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
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
