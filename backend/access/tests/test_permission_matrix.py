"""P3.8: every role against every API endpoint, on the golden event, including denials.

MATRIX lists the access rule of every API route. The first test fails as soon as
someone adds an endpoint without listing it here, so no endpoint ships untested.
Rules:
- "public": anyone, signed in or not, is let through (never 401/403);
- "signed_in": any signed-in person; anonymous callers are refused;
- "context": a signed-in person acting in a workspace (403 context_required without one);
- a permission code: an organization workspace whose role grants it (403 otherwise).
"""

from django.test import TestCase

from outbox.worker import deliver_due
from platform_core.checks import iter_routes

from .golden import ACTORS, Golden, build_golden

MATRIX: dict[str, list[tuple[str, str]]] = {
    "api/v1/auth/csrf/": [("get", "public")],
    "api/v1/auth/config/": [("get", "public")],
    "api/v1/auth/session/": [("get", "public")],
    "api/v1/auth/login/": [("post", "public")],
    "api/v1/auth/logout/": [("post", "public")],
    "api/v1/auth/register/": [("post", "public")],
    "api/v1/auth/verify-email/": [("post", "public")],
    "api/v1/auth/verify-email/resend/": [("post", "public")],
    "api/v1/auth/password-reset/": [("post", "public")],
    "api/v1/auth/password-reset/confirm/": [("post", "public")],
    "api/v1/auth/providers/<str:provider>/start/": [("post", "public")],
    "api/v1/me/": [("get", "signed_in")],
    "api/v1/me/contexts/": [("get", "signed_in")],
    "api/v1/me/context/": [("get", "context"), ("put", "signed_in")],
    "api/v1/invitations/preview/": [("post", "public")],
    "api/v1/invitations/accept/": [("post", "signed_in")],
    "api/v1/activity/": [("get", "activity.view")],
    "api/v1/organizer/venues/": [("get", "readiness.view")],
    "api/v1/venue-readiness/<uuid:readiness_id>/update-requests/": [("post", "readiness.request_update")],
    "api/v1/health/live/": [("get", "public")],
    "api/v1/health/ready/": [("get", "public")],
    "api/v1/schema/": [("get", "public")],
}

# Routes that exist only in some configurations (the OpenAPI schema is served with DEBUG on).
CONDITIONAL = {"api/v1/schema/"}
SAMPLE_PATHS = {"<str:provider>": "google", "<uuid:readiness_id>": "00000000-0000-4000-8000-000000000000"}
# Golden actors whose role grants each permission (access migration 0002, readiness migration 0002).
HOLDERS = {
    "activity.view": {
        "director",
        "coordinator",
        "officials",
        "access_manager",
        "venue_staff",
        "club_a",
        "club_b",
        "club_c",
    },
    "readiness.view": {"director", "coordinator"},
    "readiness.request_update": {"director", "coordinator"},
}


def concrete(route: str) -> str:
    for placeholder, value in SAMPLE_PATHS.items():
        route = route.replace(placeholder, value)
    return "/" + route


def expected_allowed(rule: str, actor: str) -> bool:
    if rule == "public":
        return True
    if actor == "anonymous":
        return False
    if rule == "signed_in":
        return True
    if rule == "context":
        return actor != "undecided"
    return actor in HOLDERS[rule]


class PermissionMatrixTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def test_every_api_endpoint_is_in_the_matrix(self):
        routes = {route for route, _ in iter_routes() if route.startswith("api/")}
        self.assertEqual(sorted(routes - MATRIX.keys()), [], "Add these endpoints to MATRIX with their access rule.")
        self.assertEqual(sorted(MATRIX.keys() - routes - CONDITIONAL), [], "These MATRIX entries no longer exist.")

    def test_every_actor_against_every_endpoint(self):
        routes = {route for route, _ in iter_routes()}
        for route, operations in MATRIX.items():
            if route not in routes:
                continue
            for method, rule in operations:
                for actor in ACTORS:
                    with self.subTest(route=route, method=method, actor=actor):
                        client = self.golden.client(actor)
                        response = getattr(client, method)(concrete(route), {}, format="json")
                        refused = response.status_code in (401, 403)
                        if expected_allowed(rule, actor):
                            self.assertFalse(refused, f"{actor} was refused: {response.content[:200]!r}")
                        else:
                            self.assertTrue(refused, f"{actor} was let through ({response.status_code})")
                            code = response.json()["error"]["code"]
                            if actor == "anonymous":
                                self.assertEqual(code, "not_authenticated")
                            elif rule == "context" or (rule not in ("public", "signed_in") and actor == "undecided"):
                                self.assertEqual(code, "context_required")
                            else:
                                self.assertEqual(code, "permission_denied")


class UninvitedOrganizationTests(TestCase):
    """Club C sees nothing that belongs to anyone else, on any path (golden-event negative case)."""

    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()
        deliver_due()  # build the activity feed from the set-up's events

    def feed(self, actor: str) -> list[str]:
        response = self.golden.client(actor).get("/api/v1/activity/")
        self.assertEqual(response.status_code, 200, response.content)
        return [entry["summary"] for entry in response.json()["results"]]

    def test_each_organization_sees_only_its_own_activity(self):
        riverside = self.feed("director")
        self.assertTrue(riverside)
        self.assertTrue(all("Riverside" in line for line in riverside), riverside)
        club_c = self.feed("club_c")
        self.assertTrue(all("Club C" in line for line in club_c), club_c)
        for line in club_c:
            self.assertNotIn("Riverside", line)
            self.assertNotIn("Club A", line)

    def test_session_lists_only_the_permissions_of_the_active_role(self):
        session = self.golden.client("officials").get("/api/v1/me/").json()
        self.assertEqual(session["permissions"], ["activity.view", "organization.view"])
        self.assertEqual(session["context"]["role_name"], "Officials coordinator")
        self.assertEqual(self.golden.client("legacy").get("/api/v1/me/").json()["permissions"], [])
        self.assertEqual(self.golden.client("individual").get("/api/v1/me/").json()["permissions"], [])
