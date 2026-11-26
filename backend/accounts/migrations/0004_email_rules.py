"""Email addresses are stored in lower case and unique whatever the capitals (D-046).

Existing addresses are lower-cased first. Two accounts whose addresses differ only
in capitals cannot be merged automatically: the migration stops and names them.
"""

import django.db.models.functions.text
from django.db import migrations, models
from django.db.models.functions import Lower



def lowercase_emails(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seen: dict[str, str] = {}
    clashes = []
    for user in User.objects.order_by("pk"):
        key = user.email.lower()
        if key in seen:
            clashes.append(f"{seen[key]} / {user.public_id}")
        seen[key] = str(user.public_id)
    if clashes:
        raise RuntimeError(
            "These accounts have the same email apart from capitals; merge or change one of each pair first: "
            + "; ".join(clashes)
        )
    for user in User.objects.exclude(email=Lower("email")):
        user.email = user.email.lower()
        user.save(update_fields=["email"])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_move_organizations'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(lowercase_emails, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.CheckConstraint(condition=models.Q(('email', django.db.models.functions.text.Lower('email'))), name='user_email_lowercase'),
        ),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.UniqueConstraint(django.db.models.functions.text.Upper('email'), name='user_email_unique_any_case'),
        ),
    ]
