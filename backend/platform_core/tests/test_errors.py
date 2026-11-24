from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from platform_core.errors import ApiError, error_body

from .helpers import ITEMS, REFERENCE_URLS, make_user, signed_in_client


class ErrorBodyTests(SimpleTestCase):
    def test_minimal_body_outside_a_request(self):
        self.assertEqual(
            error_body("not_found", "Not found."), {"error": {"code": "not_found", "message": "Not found."}}
        )

    def test_fields_and_extra_never_override_the_core_keys(self):
        body = error_body("x", "msg", fields={"title": ["Required."]}, extra={"code": "hijack", "retry_after": 3})
        self.assertEqual(body["error"]["code"], "x")
        self.assertEqual(body["error"]["fields"], {"title": ["Required."]})
        self.assertEqual(body["error"]["retry_after"], 3)

    def test_api_error_keeps_status_and_details(self):
        error = ApiError("version_conflict", "Changed.", 409, extra={"current_version": 4})
        self.assertEqual(
            (error.status_code, error.code, error.extra), (409, "version_conflict", {"current_version": 4})
        )


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class ErrorEnvelopeTests(TestCase):
    def assertEnvelope(self, response, status, code):
        self.assertEqual(response.status_code, status)
        self.assertEqual(response["Content-Type"], "application/json")
        error = response.json()["error"]
        self.assertEqual(error["code"], code)
        self.assertTrue(error["message"])
        self.assertEqual(error["request_id"], response["X-Request-ID"])
        return error

    def test_unknown_api_url_is_404_json(self):
        self.assertEnvelope(self.client.get("/api/v1/no-such-thing/"), 404, "not_found")

    def test_other_paths_keep_django_pages(self):
        response = self.client.get("/no-such-page/")
        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(response["Content-Type"], "application/json")

    def test_not_authenticated_is_401(self):
        self.assertEnvelope(self.client.get(ITEMS), 401, "not_authenticated")

    def test_validation_error_lists_fields(self):
        client = signed_in_client(make_user())
        response = client.post(ITEMS, {"title": ""}, format="json", HTTP_IDEMPOTENCY_KEY="k-validation")
        error = self.assertEnvelope(response, 400, "validation_error")
        self.assertIn("title", error["fields"])
        self.assertIn("starts_at", error["fields"])

    def test_unparseable_json_is_400(self):
        client = signed_in_client(make_user())
        response = client.post(ITEMS, "{not json", content_type="application/json", HTTP_IDEMPOTENCY_KEY="k-parse")
        self.assertEnvelope(response, 400, "parse_error")

    def test_drf_method_not_allowed_is_405_with_allow(self):
        client = signed_in_client(make_user())
        response = client.delete(ITEMS)
        self.assertEnvelope(response, 405, "method_not_allowed")
        self.assertIn("POST", response["Allow"])

    def test_probe_method_not_allowed_is_405_with_allow(self):
        response = self.client.post("/api/v1/health/ready/")
        self.assertEnvelope(response, 405, "method_not_allowed")
        self.assertEqual(response["Allow"], "GET, HEAD")

    def test_unexpected_exception_is_500_without_details(self):
        self.client.force_login(make_user())
        self.client.raise_request_exception = False
        with self.assertLogs("django.request", "ERROR"):
            response = self.client.get("/api/v1/reference/failing/")
        self.assertEnvelope(response, 500, "server_error")
        self.assertNotIn("secret detail", response.content.decode())
        self.assertNotIn("Traceback", response.content.decode())

    def test_csrf_failure_is_403_json(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post(
            "/api/v1/auth/login/",
            {"email": "a@example.com", "password": "x", "account_type": "individual"},
            format="json",
        )
        self.assertEnvelope(response, 403, "csrf_failed")

    @override_settings(ALLOWED_HOSTS=["sports.example.com"])
    def test_rejected_host_is_400_json(self):
        with self.assertLogs("django.security.DisallowedHost", "ERROR"):
            response = self.client.get("/api/v1/auth/config/", HTTP_HOST="evil.example")
        self.assertEnvelope(response, 400, "bad_request")
