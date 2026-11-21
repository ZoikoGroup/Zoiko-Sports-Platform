import importlib.util
import json
import logging
import os
import sys
from io import StringIO
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch

from django.core.management import CommandError, call_command
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings

from config.database import DatabaseConfigError, database_from_env
from platform_core import health
from platform_core.logging import JsonFormatter

SETTINGS_FILE = Path(__file__).resolve().parent.parent / "config" / "settings.py"


def load_settings(env: dict[str, str]) -> ModuleType:
    """A fresh, isolated copy of config/settings.py evaluated with exactly `env`.

    The running configuration (django.conf.settings) is not touched.
    """
    spec = importlib.util.spec_from_file_location("config._settings_under_test", SETTINGS_FILE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    with patch.dict(os.environ, {"DJANGO_READ_DOTENV": "false", **env}, clear=True):
        spec.loader.exec_module(module)
    return module


class SettingsDefaultsTests(SimpleTestCase):
    def test_debug_is_off_unless_enabled(self):
        settings = load_settings({"DJANGO_SECRET_KEY": "k" * 50})
        self.assertFalse(settings.DEBUG)
        self.assertTrue(settings.SESSION_COOKIE_SECURE)  # secure cookies follow debug off

    def test_debug_off_without_a_secret_key_refuses_to_start(self):
        with self.assertRaisesMessage(RuntimeError, "set DJANGO_DEBUG=true in backend/.env"):
            load_settings({})

    def test_debug_on_uses_the_development_key_and_text_logs(self):
        settings = load_settings({"DJANGO_DEBUG": "true"})
        self.assertTrue(settings.DEBUG)
        self.assertTrue(settings.SECRET_KEY.startswith("dev-only"))
        self.assertEqual(settings.LOG_FORMAT, "text")

    def test_empty_values_count_as_unset(self):
        settings = load_settings({"DJANGO_DEBUG": "", "DJANGO_SECRET_KEY": "k" * 50, "DJANGO_DEFAULT_FROM_EMAIL": ""})
        self.assertFalse(settings.DEBUG)
        self.assertEqual(settings.DEFAULT_FROM_EMAIL, "Zoiko Sports <no-reply@zoikosports.local>")


@override_settings(ALLOWED_HOSTS=["sports.example.com"])
class HealthProbeHostTests(TestCase):
    """Probes are called by IP (Docker uses 127.0.0.1:8000), not by the public host name."""

    def setUp(self):
        health._migrations_applied = False

    def test_probes_answer_under_a_production_host_list(self):
        for path in ("/api/v1/health/live/", "/api/v1/health/ready/"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path, HTTP_HOST="127.0.0.1:8000").status_code, 200)

    def test_every_other_url_still_validates_the_host(self):
        with self.assertLogs("django.security.DisallowedHost", "ERROR"):
            response = self.client.get("/api/v1/auth/config/", HTTP_HOST="127.0.0.1:8000")
        self.assertEqual(response.status_code, 400)
        allowed = self.client.get("/api/v1/auth/config/", HTTP_HOST="sports.example.com")
        self.assertEqual(allowed.status_code, 200)

    def test_probes_keep_their_method_rules(self):
        self.assertEqual(self.client.post("/api/v1/health/live/", HTTP_HOST="127.0.0.1:8000").status_code, 405)
        self.assertEqual(self.client.head("/api/v1/health/ready/", HTTP_HOST="127.0.0.1:8000").status_code, 200)


class DatabaseFromEnvTests(SimpleTestCase):
    def test_defaults_target_a_local_pooled_postgres(self):
        config = database_from_env({})
        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(
            (config["HOST"], config["PORT"], config["NAME"], config["USER"]), ("127.0.0.1", "5432", "zoiko", "zoiko")
        )
        self.assertEqual(config["PASSWORD"], "")
        self.assertEqual(config["OPTIONS"]["pool"], {"min_size": 1, "max_size": 10, "timeout": 10})
        self.assertEqual(config["CONN_MAX_AGE"], 0)  # required by the pool
        self.assertFalse(config["CONN_HEALTH_CHECKS"])
        self.assertNotIn("sslmode", config["OPTIONS"])
        self.assertNotIn("TEST", config)

    def test_postgres_container_variables_are_the_fallback(self):
        config = database_from_env({"POSTGRES_DB": "zs", "POSTGRES_USER": "app", "POSTGRES_PASSWORD": "s3cret"})
        self.assertEqual((config["NAME"], config["USER"], config["PASSWORD"]), ("zs", "app", "s3cret"))

    def test_database_variables_take_precedence(self):
        config = database_from_env(
            {
                "POSTGRES_DB": "zs",
                "POSTGRES_PASSWORD": "container",
                "DATABASE_NAME": "app_db",
                "DATABASE_PASSWORD": "explicit",
                "DATABASE_HOST": "db",
                "DATABASE_PORT": "5433",
                "DATABASE_SSLMODE": "verify-full",
                "DATABASE_TEST_NAME": "ci_tests",
            }
        )
        self.assertEqual(
            (config["NAME"], config["PASSWORD"], config["HOST"], config["PORT"]), ("app_db", "explicit", "db", "5433")
        )
        self.assertEqual(config["OPTIONS"]["sslmode"], "verify-full")
        self.assertEqual(config["TEST"], {"NAME": "ci_tests"})

    def test_without_the_pool_connections_are_reused_with_health_checks(self):
        config = database_from_env({"DATABASE_POOL": "false", "DATABASE_CONN_MAX_AGE": "120"})
        self.assertNotIn("pool", config["OPTIONS"])
        self.assertEqual(config["CONN_MAX_AGE"], 120)
        self.assertTrue(config["CONN_HEALTH_CHECKS"])

    def test_invalid_values_are_rejected_with_the_variable_name(self):
        for env, variable in [
            ({"DATABASE_PORT": "abc"}, "DATABASE_PORT"),
            ({"DATABASE_PORT": "0"}, "DATABASE_PORT"),
            ({"DATABASE_POOL": "maybe"}, "DATABASE_POOL"),
            ({"DATABASE_POOL_MAX_SIZE": "0"}, "DATABASE_POOL_MAX_SIZE"),
            ({"DATABASE_POOL_MIN_SIZE": "5", "DATABASE_POOL_MAX_SIZE": "2"}, "DATABASE_POOL_MIN_SIZE"),
            ({"DATABASE_CONNECT_TIMEOUT": "0"}, "DATABASE_CONNECT_TIMEOUT"),
        ]:
            with self.subTest(env=env), self.assertRaisesMessage(DatabaseConfigError, variable):
                database_from_env(env)


class JsonFormatterTests(SimpleTestCase):
    def format(self, record: logging.LogRecord) -> dict:
        line = JsonFormatter().format(record)
        self.assertNotIn("\n", line)  # one object per line
        return json.loads(line)

    def record(self, msg="Signed in %s", args=("user=5",), **extra):
        record = logging.LogRecord("accounts", logging.INFO, __file__, 1, msg, args, None)
        record.__dict__.update(extra)
        return record

    def test_core_fields(self):
        data = self.format(self.record())
        self.assertEqual(data["level"], "INFO")
        self.assertEqual(data["logger"], "accounts")
        self.assertEqual(data["message"], "Signed in user=5")
        self.assertRegex(data["timestamp"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$")

    def test_scalar_extras_are_kept_and_objects_dropped(self):
        data = self.format(self.record(status_code=404, method="GET", request=object(), payload={"password": "x"}))
        self.assertEqual((data["status_code"], data["method"]), (404, "GET"))
        self.assertNotIn("request", data)
        self.assertNotIn("payload", data)

    def test_exceptions_are_included(self):
        try:
            raise ValueError("boom")
        except ValueError:
            record = logging.LogRecord("x", logging.ERROR, __file__, 1, "failed", (), sys.exc_info())
        data = self.format(record)
        self.assertIn("ValueError: boom", data["exception"])


class HealthTests(TestCase):
    def setUp(self):
        health._migrations_applied = False

    def test_liveness_needs_nothing_and_is_never_cached(self):
        with patch.object(health, "connection") as connection:
            response = self.client.get("/api/v1/health/live/")
            connection.cursor.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-cache", response["Cache-Control"])

    def test_ready_when_the_database_answers_and_migrations_are_applied(self):
        response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "checks": {"database": "ok", "migrations": "ok"}})
        self.assertEqual(self.client.head("/api/v1/health/ready/").status_code, 200)

    def test_not_ready_when_the_database_is_down(self):
        failing = MagicMock()
        failing.cursor.side_effect = OperationalError("connection refused to 10.0.0.5")
        with patch.object(health, "connection", failing), self.assertLogs("platform_core.health", "WARNING"):
            response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"status": "unavailable", "checks": {"database": "unavailable", "migrations": "unavailable"}},
        )
        self.assertNotIn("10.0.0.5", response.content.decode())  # details stay in the log

    def test_not_ready_while_migrations_are_pending(self):
        with (
            patch.object(health.MigrationExecutor, "migration_plan", return_value=[("migration", False)]),
            self.assertLogs("platform_core.health", "WARNING"),
        ):
            response = self.client.get("/api/v1/health/ready/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["checks"], {"database": "ok", "migrations": "pending"})

    def test_probes_only_accept_safe_methods(self):
        self.assertEqual(self.client.post("/api/v1/health/ready/").status_code, 405)
        self.assertEqual(self.client.post("/api/v1/health/live/").status_code, 405)


class WaitForDbTests(SimpleTestCase):
    def run_command(self, connection, **options):
        out = StringIO()
        with (
            patch("platform_core.management.commands.wait_for_db.connections", {"default": connection}),
            patch("time.sleep"),
        ):
            call_command("wait_for_db", stdout=out, **options)
        return out.getvalue()

    def test_returns_once_the_database_answers(self):
        connection = MagicMock()
        connection.cursor.side_effect = [OperationalError("starting"), OperationalError("starting"), MagicMock()]
        self.assertIn("attempt 3", self.run_command(connection, timeout=30, interval=1))
        self.assertEqual(connection.close.call_count, 2)

    def test_gives_up_after_the_timeout(self):
        connection = MagicMock()
        connection.cursor.side_effect = OperationalError("password authentication failed for user zoiko")
        with self.assertRaises(CommandError) as raised:
            self.run_command(connection, timeout=0.5, interval=1)
        self.assertIn("OperationalError", str(raised.exception))
        self.assertNotIn("password", str(raised.exception))

    def test_rejects_non_positive_values(self):
        with self.assertRaises(CommandError):
            self.run_command(MagicMock(), timeout=0)
