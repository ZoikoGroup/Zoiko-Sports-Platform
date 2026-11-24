import tempfile
from pathlib import Path

import yaml
from django.core.management import call_command
from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator

from .helpers import REFERENCE_URLS

COMMITTED_SCHEMA = Path(__file__).resolve().parents[2] / "openapi.yaml"


def generate(urlconf: str | None = None) -> dict:
    return SchemaGenerator(urlconf=urlconf).get_schema(request=None, public=True)


class OpenApiTests(SimpleTestCase):
    def test_schema_generates_with_zero_warnings_and_validates(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "openapi.yaml"
            # --fail-on-warn makes the command fail on any warning or error.
            call_command("spectacular", "--validate", "--fail-on-warn", "--file", str(target))
            self.assertTrue(target.read_text(encoding="utf-8"))

    def test_committed_schema_matches_the_code(self):
        """backend/openapi.yaml is the reviewed contract: regenerate it when the API changes."""
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "openapi.yaml"
            call_command("spectacular", "--file", str(target))
            self.assertEqual(
                yaml.safe_load(target.read_text(encoding="utf-8")),
                yaml.safe_load(COMMITTED_SCHEMA.read_text(encoding="utf-8")),
                "openapi.yaml is out of date: run `python manage.py spectacular --file openapi.yaml`.",
            )

    def test_every_auth_endpoint_is_documented_with_its_errors(self):
        schema = generate()
        paths = schema["paths"]
        self.assertEqual(len([p for p in paths if p.startswith("/api/v1/auth/")]), 11)
        login = paths["/api/v1/auth/login/"]["post"]
        self.assertEqual(set(login["responses"]), {"200", "400", "403", "429"})
        error = schema["components"]["schemas"]["ErrorDetail"]
        self.assertTrue({"code", "message", "request_id"} <= set(error["properties"]))

    def test_kernel_conventions_are_documented(self):
        schema = generate(REFERENCE_URLS)
        items = schema["paths"]["/api/v1/reference/items/"]
        create = items["post"]
        header = next(p for p in create["parameters"] if p["in"] == "header")
        self.assertEqual((header["name"], header["required"]), ("Idempotency-Key", True))
        self.assertIn("422", create["responses"])

        listing = items["get"]
        query = {p["name"] for p in listing["parameters"] if p["in"] == "query"}
        self.assertTrue({"cursor", "page_size", "q", "status"} <= query)
        page_ref = listing["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
        self.assertEqual(set(schema["components"]["schemas"][page_ref]["properties"]), {"next", "previous", "results"})

        patch = schema["paths"]["/api/v1/reference/items/{item_id}/"]["patch"]
        conflict_ref = patch["responses"]["409"]["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
        conflict = schema["components"]["schemas"][conflict_ref]["properties"]["error"]["$ref"].rsplit("/", 1)[-1]
        self.assertIn("current_version", schema["components"]["schemas"][conflict]["properties"])

        item = schema["components"]["schemas"]["Item"]["properties"]
        self.assertEqual((item["id"]["format"], item["starts_at"]["format"]), ("uuid", "date-time"))
