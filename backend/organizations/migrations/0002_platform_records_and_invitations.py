"""P2: platform record conventions, organization verification and invitations.

- Organizations and memberships get a public UUID (filled row by row, then made
  unique) and created/updated timestamps (platform_core.models.PlatformModel).
- Organizations gain a verification state: new ones start "pending" and grant
  no workspace until verified. Existing active organizations count as verified
  (verified_at = created_at); suspended ones stay suspended.
- Invitations: single-use, expiring, token stored as a hash; one pending
  invitation per organization and email address.
- Django's content types for the two moved models follow them to this app, so
  permission rows keep pointing at the right models.
"""

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
from django.db.models import F

MOVED_MODELS = ("organization", "membership")


def fill_public_ids(apps, schema_editor):
    for name in ("Organization", "Membership"):
        model = apps.get_model("organizations", name)
        for row in model.objects.filter(public_id__isnull=True).only("pk").iterator():
            model.objects.filter(pk=row.pk).update(public_id=uuid.uuid4())


def mark_existing_active_as_verified(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Organization.objects.filter(status="active", verified_at__isnull=True).update(verified_at=F("created_at"))


def move_content_types(apps, schema_editor, source="accounts", target="organizations"):
    ContentType = apps.get_model("contenttypes", "ContentType")
    for model in MOVED_MODELS:
        if not ContentType.objects.filter(app_label=target, model=model).exists():
            ContentType.objects.filter(app_label=source, model=model).update(app_label=target)


def restore_content_types(apps, schema_editor):
    move_content_types(apps, schema_editor, source="organizations", target="accounts")


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # --- Public identifiers -------------------------------------------------
        migrations.AddField(
            model_name="organization",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(fill_public_ids, migrations.RunPython.noop, elidable=False),
        migrations.AlterField(
            model_name="organization",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="membership",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        # --- Timestamps -----------------------------------------------------------
        migrations.AlterField(
            model_name="organization",
            name="created_at",
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
        ),
        migrations.AlterField(
            model_name="membership",
            name="created_at",
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
        ),
        migrations.AddField(
            model_name="organization",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="membership",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        # --- Verification ---------------------------------------------------------
        migrations.AlterField(
            model_name="organization",
            name="status",
            field=models.CharField(
                choices=[("pending", "Pending verification"), ("active", "Active"), ("suspended", "Suspended")],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="organization",
            name="verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(mark_existing_active_as_verified, migrations.RunPython.noop, elidable=False),
        # --- Invitations ----------------------------------------------------------
        migrations.CreateModel(
            name="Invitation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("email", models.EmailField(max_length=254)),
                ("role", models.CharField(max_length=60)),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("accepted", "Accepted"), ("revoked", "Revoked")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("expires_at", models.DateTimeField()),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "accepted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "invited_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="invitations",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("status", "pending")),
                        fields=("organization", "email"),
                        name="one_pending_invitation_per_email",
                    )
                ],
            },
        ),
        # --- Content types ----------------------------------------------------------
        migrations.RunPython(move_content_types, restore_content_types, elidable=False),
    ]
