"""Tables of the access module: the role and permission catalogue, stored as data (P3.1).

- Permission: one action code such as "activity.view" (`<resource>.<verb>`).
- Role: what a member of an organization is (competition_director, venue_manager…).
  `organization_kinds` limits which kinds of organization may assign it (empty =
  any kind). Roles no longer offered stay for existing members with
  `is_assignable = False`.
- RolePermission: which permissions a role grants. Changing the catalogue is a
  data change (a migration or the operator command), never a code change.
- ParticipationProfile: the capacity in which an organization takes part in
  someone else's event (club, venue, officials). Used from P5, when event
  participation becomes the second gate of the policy engine.
- SharedField: a field of another organization's record that a participation
  profile may see (field-level visibility). Nothing is shared unless listed.

The seed catalogue (migration 0002) is an assumption until the company signs off
the role catalogue (GP1; decision D-039).
"""

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q

from platform_core.models import PlatformModel

CODE_HELP = "Lower-case identifier; never reused for a different meaning."
# The database refuses malformed codes (D-046).
IDENTIFIER = r"^[a-z][a-z0-9_]{1,59}$"
PERMISSION_CODE = r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$"
# organizations.Organization.Kind values (a test keeps the two in step; the access
# module may not import the organizations module's models).
ORGANIZATION_KINDS = ["organizer", "venue", "club"]


class Permission(PlatformModel):
    code = models.CharField(max_length=80, unique=True, help_text="'<resource>.<verb>', e.g. activity.view")
    description = models.CharField(max_length=200)

    class Meta:
        ordering = ["code"]
        constraints = [models.CheckConstraint(condition=Q(code__regex=PERMISSION_CODE), name="permission_code_format")]

    def __str__(self) -> str:
        return self.code


class Role(PlatformModel):
    # Same width as organizations.Membership.role, which references it.
    code = models.CharField(max_length=60, unique=True, help_text=CODE_HELP)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True)
    organization_kinds = ArrayField(
        models.CharField(max_length=20), default=list, blank=True, help_text="Empty: any kind of organization."
    )
    is_assignable = models.BooleanField(default=True, help_text="Offered for new members and invitations.")
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(condition=Q(code__regex=IDENTIFIER), name="role_code_format"),
            models.CheckConstraint(
                condition=Q(organization_kinds__contained_by=ORGANIZATION_KINDS), name="role_organization_kinds_valid"
            ),
        ]

    def __str__(self) -> str:
        return self.code


class RolePermission(models.Model):
    # No separate index on role: unique_role_permission (role, permission) already starts with it.
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="grants", db_index=False)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="grants")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["role", "permission"], name="unique_role_permission")]

    def __str__(self) -> str:
        return f"{self.role_id} → {self.permission_id}"


class ParticipationProfile(PlatformModel):
    code = models.CharField(max_length=40, unique=True, help_text=CODE_HELP)
    name = models.CharField(max_length=100)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="profiles")

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(condition=Q(code__regex=IDENTIFIER), name="participation_profile_code_format")
        ]

    def __str__(self) -> str:
        return self.code


class SharedField(models.Model):
    resource = models.CharField(max_length=60, help_text="Resource type, e.g. fixture")
    field = models.CharField(max_length=60)
    profile = models.ForeignKey(ParticipationProfile, on_delete=models.CASCADE, related_name="shared_fields")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["resource", "field", "profile"], name="unique_shared_field"),
        ]

    def __str__(self) -> str:
        return f"{self.resource}.{self.field} → {self.profile_id}"
