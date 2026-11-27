"""Seed role and permission catalogue (P3.1).

An assumption until the company signs off the role catalogue (GP1): the roles the
project documents name (HO §09, FSD §10/§11), with the permissions that exist
so far. Later phases add their own permissions in their own data migrations
(competition.*, fixture.* …). Decision D-039.
"""

import uuid

from django.db import migrations

PERMISSIONS = {
    "organization.view": "See the organization's profile and status.",
    "membership.view": "See the organization's members and their roles.",
    "membership.manage": "Change or remove members' access.",
    "invitation.manage": "Invite people to the organization and withdraw invitations.",
    "activity.view": "See the organization's activity feed.",
    "audit.view": "Read the organization's audit trail (restricted).",
}

VIEW = ["organization.view", "membership.view", "activity.view"]
LEAD = [*VIEW, "audit.view"]

# code: (name, description, organization kinds (empty = any), permissions)
ROLES = {
    "competition_director": (
        "Competition director",
        "Leads the organizer's competitions; final say on schedules (from P6).",
        ["organizer"],
        LEAD,
    ),
    "organizer_coordinator": (
        "Organizer coordinator",
        "Runs day-to-day competition operations for the organizer.",
        ["organizer"],
        VIEW,
    ),
    "officials_coordinator": (
        "Officials coordinator",
        "Assigns and coordinates match officials for the organizer.",
        ["organizer"],
        ["organization.view", "activity.view"],
    ),
    "venue_manager": ("Venue manager", "Leads the venue's operations and readiness.", ["venue"], LEAD),
    "venue_staff": (
        "Venue staff",
        "Works at the venue (stewards, gate and operations staff).",
        ["venue"],
        ["organization.view", "activity.view"],
    ),
    "club_coordinator": ("Club coordinator", "Leads the club's participation in events.", ["club"], LEAD),
    "organization_access_manager": (
        "Organization access manager",
        "Manages who has access to the organization: invitations, roles and removals.",
        [],
        [*LEAD, "membership.manage", "invitation.manage"],
    ),
}

PROFILES = {
    "club": "Participating club",
    "venue": "Host venue",
    "officials": "Officials",
}


def seed(apps, schema_editor):
    Permission = apps.get_model("access", "Permission")
    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    ParticipationProfile = apps.get_model("access", "ParticipationProfile")

    permissions = {}
    for code, description in PERMISSIONS.items():
        permissions[code], _ = Permission.objects.get_or_create(
            code=code, defaults={"description": description, "public_id": uuid.uuid4()}
        )
    for code, (name, description, kinds, granted) in ROLES.items():
        role, _ = Role.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
                "organization_kinds": kinds,
                "is_assignable": True,
                "public_id": uuid.uuid4(),
            },
        )
        for permission_code in granted:
            RolePermission.objects.get_or_create(role=role, permission=permissions[permission_code])
    for code, name in PROFILES.items():
        ParticipationProfile.objects.get_or_create(code=code, defaults={"name": name, "public_id": uuid.uuid4()})


def unseed(apps, schema_editor):
    apps.get_model("access", "RolePermission").objects.filter(role__code__in=ROLES).delete()
    apps.get_model("access", "Role").objects.filter(code__in=ROLES).delete()
    apps.get_model("access", "Permission").objects.filter(code__in=PERMISSIONS).delete()
    apps.get_model("access", "ParticipationProfile").objects.filter(code__in=PROFILES).delete()


class Migration(migrations.Migration):
    dependencies = [("access", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
