"""Database-level integrity rules for organizations, memberships and invitations (D-046).

Before the new CHECK constraints are added, existing rows are brought into line:
- the retired membership status "invited" (from before invitations had their own
  table; it never granted access) becomes "revoked", which also grants nothing;
- invitation emails are stored in lower case (the application always did this);
- accepted / revoked invitations and active organizations get the timestamp their
  state requires, taken from when the row last changed (the application always set it);
- a membership whose validity window ends before it starts cannot be fixed
  automatically: the migration stops and names it.

It also renames the indexes and constraints still called accounts_* since P2 moved
these tables out of the accounts module, and drops two indexes that duplicated the
start of an existing unique index (membership.user, membership.role, invitation.role).
"""

import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models
from django.db.models import F
from django.db.models.functions import Lower


def bring_rows_into_line(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Membership = apps.get_model("organizations", "Membership")
    Invitation = apps.get_model("organizations", "Invitation")
    Membership.objects.filter(status="invited").update(status="revoked")
    for invitation in Invitation.objects.exclude(email=Lower("email")):
        invitation.email = invitation.email.lower()
        invitation.save(update_fields=["email"])
    Invitation.objects.filter(status="accepted", accepted_at__isnull=True).update(accepted_at=F("updated_at"))
    Invitation.objects.filter(status="revoked", revoked_at__isnull=True).update(revoked_at=F("updated_at"))
    Organization.objects.filter(status="active", verified_at__isnull=True).update(verified_at=F("created_at"))
    reversed_windows = list(
        Membership.objects.filter(valid_from__isnull=False, valid_to__isnull=False, valid_to__lte=F("valid_from"))
        .values_list("public_id", flat=True)
    )
    if reversed_windows:
        raise RuntimeError(
            "These memberships end before they start; fix their valid_from / valid_to first: "
            + ", ".join(str(public_id) for public_id in reversed_windows)
        )


RENAMES = [
    # (kind, old name, new name); kind "constraint" renames a table constraint, "index" an index.
    ("constraint", "accounts_membership_pkey", "organizations_membership_pkey"),
    ("constraint", "accounts_organization_pkey", "organizations_organization_pkey"),
    ("constraint", "accounts_membership_organization_id_936776de_fk_accounts_", "organizations_membership_organization_fk"),
    ("constraint", "accounts_membership_user_id_487fb39e_fk_accounts_user_id", "organizations_membership_user_fk"),
    ("index", "accounts_membership_organization_id_936776de", "organizations_membership_organization_idx"),
    ("index", "accounts_membership_user_id_487fb39e", "organizations_membership_user_idx"),
]
TABLES = {
    "accounts_membership_pkey": "organizations_membership",
    "accounts_organization_pkey": "organizations_organization",
    "accounts_membership_organization_id_936776de_fk_accounts_": "organizations_membership",
    "accounts_membership_user_id_487fb39e_fk_accounts_user_id": "organizations_membership",
}


def _rename(schema_editor, pairs):
    with schema_editor.connection.cursor() as cursor:
        for kind, old, new in pairs:
            if kind == "index":
                cursor.execute(f'ALTER INDEX IF EXISTS "{old}" RENAME TO "{new}"')
                continue
            table = TABLES.get(old) or TABLES.get(new)
            cursor.execute("SELECT 1 FROM pg_constraint WHERE conname = %s", [old])
            if cursor.fetchone():
                cursor.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')


def rename_legacy_names(apps, schema_editor):
    _rename(schema_editor, RENAMES)


def restore_legacy_names(apps, schema_editor):
    TABLES.update({new: TABLES[old] for kind, old, new in RENAMES if old in TABLES})
    _rename(schema_editor, [(kind, new, old) for kind, old, new in reversed(RENAMES)])


class Migration(migrations.Migration):

    dependencies = [
        ('access', '0003_integrity_rules'),
        ('organizations', '0003_roles_from_catalogue'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(bring_rows_into_line, migrations.RunPython.noop),
        migrations.RunPython(rename_legacy_names, restore_legacy_names),
        migrations.AlterField(
            model_name='invitation',
            name='role',
            field=models.ForeignKey(db_column='role', db_index=False, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='access.role', to_field='code'),
        ),
        migrations.AlterField(
            model_name='membership',
            name='role',
            field=models.ForeignKey(db_column='role', db_index=False, on_delete=django.db.models.deletion.PROTECT, related_name='+', to='access.role', to_field='code'),
        ),
        migrations.AlterField(
            model_name='membership',
            name='status',
            field=models.CharField(choices=[('active', 'Active'), ('suspended', 'Suspended'), ('revoked', 'Revoked')], default='active', max_length=20),
        ),
        migrations.AlterField(
            model_name='membership',
            name='user',
            field=models.ForeignKey(db_index=False, on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name='invitation',
            constraint=models.CheckConstraint(condition=models.Q(('status__in', ['pending', 'accepted', 'revoked'])), name='invitation_status_valid'),
        ),
        migrations.AddConstraint(
            model_name='invitation',
            constraint=models.CheckConstraint(condition=models.Q(('email', django.db.models.functions.text.Lower('email'))), name='invitation_email_lowercase'),
        ),
        migrations.AddConstraint(
            model_name='invitation',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('status', 'accepted'), _negated=True), ('accepted_at__isnull', False), _connector='OR'), name='invitation_accepted_has_time'),
        ),
        migrations.AddConstraint(
            model_name='invitation',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('status', 'revoked'), _negated=True), ('revoked_at__isnull', False), _connector='OR'), name='invitation_revoked_has_time'),
        ),
        migrations.AddConstraint(
            model_name='membership',
            constraint=models.CheckConstraint(condition=models.Q(('status__in', ['active', 'suspended', 'revoked'])), name='membership_status_valid'),
        ),
        migrations.AddConstraint(
            model_name='membership',
            constraint=models.CheckConstraint(condition=models.Q(('valid_from__isnull', True), ('valid_to__isnull', True), ('valid_to__gt', models.F('valid_from')), _connector='OR'), name='membership_validity_window_ordered'),
        ),
        migrations.AddConstraint(
            model_name='organization',
            constraint=models.CheckConstraint(condition=models.Q(('kind__in', ['organizer', 'venue', 'club'])), name='organization_kind_valid'),
        ),
        migrations.AddConstraint(
            model_name='organization',
            constraint=models.CheckConstraint(condition=models.Q(('status__in', ['pending', 'active', 'suspended'])), name='organization_status_valid'),
        ),
        migrations.AddConstraint(
            model_name='organization',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('status', 'active'), _negated=True), ('verified_at__isnull', False), _connector='OR'), name='organization_active_is_verified'),
        ),
    ]
