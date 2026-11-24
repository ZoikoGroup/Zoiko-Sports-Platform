import importlib.util
import logging
from datetime import timedelta
from pathlib import Path
from unittest import skipIf
from unittest.mock import MagicMock

from django.test import SimpleTestCase, TestCase, override_settings

from platform_core.request_context import accept_request_id, get_request_id, request_context

from .helpers import REFERENCE_URLS, capture_logs, make_user, signed_in_client

HEX_ID = r"^[0-9a-f]{32}$"
GUNICORN_CONF = Path(__file__).resolve().parents[2] / "gunicorn.conf.py"


class RequestContextUnitTests(SimpleTestCase):
    def test_well_formed_ids_are_kept_and_others_replaced(self):
        for good in ["abc", "0f" * 16, "nginx-req_42", "a" * 64]:
            self.assertEqual(accept_request_id(good), good)
        for bad in [None, "", "has space", "a" * 65, 'quote"', "line\nbreak", "semi;colon", "ünïcode"]:
            with self.subTest(bad=bad):
                self.assertRegex(accept_request_id(bad), HEX_ID)

    def test_context_nests_and_restores(self):
        self.assertIsNone(get_request_id())
        with request_context("outer") as outer:
            self.assertEqual(get_request_id(), "outer")
            with request_context() as inner:
                self.assertNotEqual(inner, outer)
                self.assertEqual(get_request_id(), inner)
            self.assertEqual(get_request_id(), "outer")
        self.assertIsNone(get_request_id())


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class RequestIdHttpTests(TestCase):
    def test_generated_when_the_caller_sends_none(self):
        response = self.client.get("/api/v1/auth/config/")
        self.assertRegex(response["X-Request-ID"], HEX_ID)

    def test_a_valid_incoming_id_is_kept(self):
        response = self.client.get("/api/v1/auth/config/", HTTP_X_REQUEST_ID="0123456789abcdef0123456789abcdef")
        self.assertEqual(response["X-Request-ID"], "0123456789abcdef0123456789abcdef")

    def test_a_malformed_incoming_id_is_replaced(self):
        response = self.client.get("/api/v1/auth/config/", HTTP_X_REQUEST_ID="forged id\twith tabs")
        self.assertRegex(response["X-Request-ID"], HEX_ID)

    def test_every_api_response_carries_an_id_and_errors_repeat_it(self):
        responses = {
            "probe": self.client.get("/api/v1/health/live/"),
            "probe 405": self.client.post("/api/v1/health/live/"),
            "unknown API URL": self.client.get("/api/v1/does-not-exist/"),
            "not authenticated": self.client.get("/api/v1/reference/items/"),
            "success": self.client.get("/api/v1/auth/session/"),
        }
        for name, response in responses.items():
            with self.subTest(name):
                request_id = response["X-Request-ID"]
                self.assertRegex(request_id, HEX_ID)
                if response.status_code >= 400:
                    self.assertEqual(response.json()["error"]["request_id"], request_id)

    def test_every_log_line_written_during_a_request_carries_its_id(self):
        with capture_logs() as logs:
            response = self.client.post(
                "/api/v1/auth/login/",
                {"email": "ghost@example.com", "password": "nope-nope-nope", "account_type": "individual"},
                content_type="application/json",
            )
        request_id = response["X-Request-ID"]
        self.assertEqual(response.status_code, 400)
        messages = [record.getMessage() for record in logs.records]
        self.assertIn("Sign-in failed (invalid credentials)", messages)  # application log line
        self.assertTrue(any(record.name == "django.request" for record in logs.records))  # framework log line
        self.assertEqual({getattr(record, "request_id", None) for record in logs.records}, {request_id})

    def test_the_context_ends_with_the_request(self):
        self.client.get("/api/v1/auth/config/")
        self.assertIsNone(get_request_id())

    def test_server_errors_are_logged_with_the_request_id(self):
        self.client.force_login(make_user())
        self.client.raise_request_exception = False
        with capture_logs() as logs:
            response = self.client.get("/api/v1/reference/failing/")
        errors = [record for record in logs.records if record.levelno >= logging.ERROR]
        self.assertTrue(errors)
        self.assertEqual(errors[0].request_id, response["X-Request-ID"])  # type: ignore[attr-defined]
        self.assertIsNotNone(errors[0].exc_info)  # the traceback stays in the log


@skipIf(importlib.util.find_spec("fcntl") is None, "gunicorn runs on Linux and macOS only (CI and the container)")
class GunicornAccessLogTests(SimpleTestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("zs_gunicorn_conf", GUNICORN_CONF)
        assert spec is not None and spec.loader is not None
        self.conf = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.conf)

    def access_line(self, headers):
        logger = MagicMock()
        logger.cfg.accesslog = "-"
        logger.atoms.return_value = {
            "s": "201",
            "m": "POST",
            "U": "/api/v1/x/",
            "B": 10,
            "h": "10.0.0.1",
            "H": "HTTP/1.1",
        }
        resp = MagicMock(headers=headers)
        self.conf.JsonAccessLogger.access(logger, resp, MagicMock(), {}, timedelta(milliseconds=12))
        return logger.access_log.info.call_args.kwargs["extra"]

    def test_access_line_joins_the_request_by_its_id(self):
        extra = self.access_line([("Content-Type", "application/json"), ("X-Request-ID", "abc123")])
        self.assertEqual(extra["request_id"], "abc123")
        self.assertEqual((extra["status"], extra["path"], extra["duration_ms"]), (201, "/api/v1/x/", 12.0))

    def test_access_line_without_an_id(self):
        self.assertNotIn("request_id", self.access_line([("Content-Type", "text/plain")]))


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class SignedInRequestTests(TestCase):
    def test_ids_differ_between_requests(self):
        client = signed_in_client(make_user())
        first = client.get("/api/v1/reference/items/")["X-Request-ID"]
        second = client.get("/api/v1/reference/items/")["X-Request-ID"]
        self.assertNotEqual(first, second)
