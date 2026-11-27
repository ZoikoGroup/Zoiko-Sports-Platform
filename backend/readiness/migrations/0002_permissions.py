"""Venue readiness permissions in the role catalogue (P12.1, D-047).

Permissions are data (D-039): each phase adds its own in a data migration. The
organizer's leads see venue readiness and may ask a venue to update it; venue-side
permissions arrive with the venue workspace (P12.5).
"""

import uuid

from django.db import migrations

PERMISSIONS = {
    "readiness.view": "See the readiness of venues hosting the organization's events.",
    "readiness.request_update": "Ask a venue to update its readiness for one of the organization's events.",
}

GRANTS = {
    "competition_director": ["readiness.view", "readiness.request_update"],
    "organizer_coordinator": ["readiness.view", "readiness.request_update"],
}


def grant(apps, schema_editor):
    Permission = apps.get_model("access", "Permission")
    Role = apps.get_model("access", "Role")
    RolePermission = apps.get_model("access", "RolePermission")
    permissions = {}
    for code, description in PERMISSIONS.items():
        permissions[code], _ = Permission.objects.get_or_create(
            code=code, defaults={"description": description, "public_id": uuid.uuid4()}
        )
    for role_code, codes in GRANTS.items():
        role = Role.objects.filter(code=role_code).first()
        if role is None:  # a catalogue that no longer has this role
            continue
        for code in codes:
            RolePermission.objects.get_or_create(role=role, permission=permissions[code])


def revoke(apps, schema_editor):
    apps.get_model("access", "Permission").objects.filter(code__in=PERMISSIONS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("readiness", "0001_initial"),
        ("access", "0003_integrity_rules"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
