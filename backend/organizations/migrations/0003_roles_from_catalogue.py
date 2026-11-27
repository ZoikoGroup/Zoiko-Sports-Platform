"""Membership and invitation roles become links to the access role catalogue (P3.1).

The column keeps its name and string values (the role code), so nothing that
reads it changes shape. Any role an existing member or invitation already has
that the catalogue does not list is kept as a non-assignable "legacy" role, so
no existing data is rejected; it grants no permissions until someone decides
what it should grant (D-039).
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models


def keep_existing_roles(apps, schema_editor):
    Role = apps.get_model("access", "Role")
    Membership = apps.get_model("organizations", "Membership")
    Invitation = apps.get_model("organizations", "Invitation")
    used = set(Membership.objects.values_list("role", flat=True)) | set(Invitation.objects.values_list("role", flat=True))
    known = set(Role.objects.values_list("code", flat=True))
    for code in sorted(used - known):
        Role.objects.create(
            code=code,
            name=code.replace("_", " ").capitalize()[:100],
            description="Kept for existing members; not in the role catalogue.",
            organization_kinds=[],
            is_assignable=False,
            public_id=uuid.uuid4(),
        )


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0002_seed_catalogue"),
        ("organizations", "0002_platform_records_and_invitations"),
    ]

    operations = [
        migrations.RunPython(keep_existing_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="invitation",
            name="role",
            field=models.ForeignKey(
                db_column="role",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="access.role",
                to_field="code",
            ),
        ),
        migrations.AlterField(
            model_name="membership",
            name="role",
            field=models.ForeignKey(
                db_column="role",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="access.role",
                to_field="code",
            ),
        ),
    ]
