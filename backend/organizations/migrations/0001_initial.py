"""Adopt the Organization and Membership tables moved from accounts (P2).

State only: the tables already exist (renamed by accounts 0003). The fields are
exactly those of accounts 0001; organizations 0002 then changes them.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0003_move_organizations"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="Organization",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                        ),
                        ("name", models.CharField(max_length=200)),
                        (
                            "kind",
                            models.CharField(
                                choices=[
                                    ("organizer", "Competition organizer"),
                                    ("venue", "Venue operator"),
                                    ("club", "Team / club"),
                                ],
                                max_length=20,
                            ),
                        ),
                        (
                            "jurisdiction",
                            models.CharField(blank=True, help_text="ISO 3166 country/subdivision code", max_length=8),
                        ),
                        (
                            "status",
                            models.CharField(
                                choices=[("active", "Active"), ("suspended", "Suspended")],
                                default="active",
                                max_length=20,
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                    ],
                ),
                migrations.CreateModel(
                    name="Membership",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                        ),
                        ("role", models.CharField(max_length=60)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("invited", "Invited"),
                                    ("active", "Active"),
                                    ("suspended", "Suspended"),
                                    ("revoked", "Revoked"),
                                ],
                                default="active",
                                max_length=20,
                            ),
                        ),
                        ("valid_from", models.DateTimeField(blank=True, null=True)),
                        ("valid_to", models.DateTimeField(blank=True, null=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "organization",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="memberships",
                                to="organizations.organization",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="memberships",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "constraints": [
                            models.UniqueConstraint(fields=("user", "organization"), name="unique_membership")
                        ],
                    },
                ),
            ],
        ),
    ]
