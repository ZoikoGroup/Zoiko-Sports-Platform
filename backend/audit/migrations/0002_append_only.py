"""Make the audit trail append-only in the database itself (P3.7).

A trigger rejects every UPDATE and DELETE on audit_auditentry, whoever issues
it (application code, a shell, a SQL client using the application's role).
TRUNCATE stays possible for the test runner and for a deliberate, privileged
retention job once retention rules exist (D09); it bypasses row triggers and is
not available through the ORM's normal paths.
"""

from django.db import migrations

CREATE = """
CREATE OR REPLACE FUNCTION audit_entry_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit entries are append-only (% refused)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_entry_append_only
    BEFORE UPDATE OR DELETE ON audit_auditentry
    FOR EACH ROW EXECUTE FUNCTION audit_entry_append_only();
"""

DROP = """
DROP TRIGGER IF EXISTS audit_entry_append_only ON audit_auditentry;
DROP FUNCTION IF EXISTS audit_entry_append_only();
"""


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]

    operations = [migrations.RunSQL(CREATE, DROP)]
