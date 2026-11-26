"""Move Organization and Membership to the organizations module (P2).

The tables are renamed in place (accounts_* -> organizations_*): rows, primary
keys and foreign keys are untouched. The models leave the accounts migration
state here and enter the organizations state in organizations 0001.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_public_id"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AlterModelTable(name="organization", table="organizations_organization"),
                migrations.AlterModelTable(name="membership", table="organizations_membership"),
            ],
            state_operations=[
                migrations.DeleteModel(name="Membership"),
                migrations.DeleteModel(name="Organization"),
            ],
        ),
    ]
