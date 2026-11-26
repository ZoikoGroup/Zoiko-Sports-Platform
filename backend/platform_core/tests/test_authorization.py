"""P3.6 deny-by-default, the authorization hooks, the event catalogue, and the admin switch (P3.9)."""

import importlib
import os
import subprocess
import sys
import tempfile
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.management import CommandError, call_command
from django.http import JsonResponse
from django.test import SimpleTestCase, override_settings
from django.urls import clear_url_caches, path
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from platform_core import authorization, events
from platform_core.checks import check_api_permissions, unprotected_api_routes
from platform_core.management.commands.event_catalogue import render
from platform_core.workspace import WorkspaceContext


class Inheriting(APIView):
    """Relies on DRF's default permission: not an explicit rule."""

    def get(self, request):
        return Response({})


class Explicit(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({})


class ExplicitByInheritance(Explicit):
    pass


def plain(request):
    return JsonResponse({})


@authorization.public_endpoint
def marked(request):
    return JsonResponse({})


urlpatterns = [
    path("api/v1/inheriting/", Inheriting.as_view()),
    path("api/v1/explicit/", Explicit.as_view()),
    path("api/v1/child/", ExplicitByInheritance.as_view()),
    path("api/v1/plain/", plain),
    path("api/v1/marked/", marked),
    path("not-api/", plain),
]


@override_settings(ROOT_URLCONF=__name__)
class DenyByDefaultTests(SimpleTestCase):
    def test_flags_api_endpoints_without_their_own_permission_rule(self):
        self.assertEqual(unprotected_api_routes(), ["api/v1/inheriting/", "api/v1/plain/"])
        errors = check_api_permissions()
        self.assertEqual([e.id for e in errors], ["platform_core.E002", "platform_core.E002"])
        self.assertIn("/api/v1/inheriting/", errors[0].msg)


class ProjectRoutesTests(SimpleTestCase):
    def test_the_real_api_has_no_unprotected_endpoint(self):
        self.assertEqual(unprotected_api_routes(), [])


class RequirePermissionTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.context = WorkspaceContext(id="o", account_type="organization", organization_id=1, role="r")

    def view(self):
        class Guarded(APIView):
            permission_classes = [authorization.RequirePermission("thing.do")]

            def get(self, request):
                return Response({"ok": True})

        return Guarded.as_view()

    def call(self, context):
        request = self.factory.get("/x")
        request.workspace_context = context  # type: ignore[attr-defined]
        return self.view()(request)

    def test_checker_decides_and_refusals_use_the_envelope(self):
        authorization.set_permission_checker(lambda context, permission, resource: permission == "thing.do")
        self.addCleanup(authorization.set_permission_checker, _engine())
        self.assertEqual(self.call(self.context).status_code, 200)
        self.assertEqual(self.call(None).data["error"]["code"], "context_required")
        authorization.set_permission_checker(lambda context, permission, resource: False)
        refused = self.call(self.context)
        self.assertEqual((refused.status_code, refused.data["error"]["code"]), (403, "permission_denied"))
        self.assertEqual(authorization.RequirePermission("thing.do").__name__, "RequirePermission[thing.do]")


def _engine():
    from access.selectors import can

    return can


class EventCatalogueTests(SimpleTestCase):
    def test_module_events_are_discovered_at_start_up(self):
        keys = {t.key for t in events.registered()}
        self.assertTrue({"invitation.accepted.v1", "organization.status_changed.v1"} <= keys)
        accepted = events.get("invitation.accepted.v1")
        assert accepted is not None
        self.assertEqual(accepted.module, "organizations")
        self.assertIsNone(events.get("nothing.v9"))
        self.assertEqual([t.key for t in events.registered(["invitation.accepted.v1"])], ["invitation.accepted.v1"])

    def test_catalogue_lists_every_event_by_publisher(self):
        content = render()
        self.assertIn("## Published by `organizations`", content)
        self.assertIn("| `invitation.accepted` | 1 | `invitation_id`, `organization_id`", content)
        self.assertIn("optional `invited_by`", content)

    def test_command_checks_and_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "events.md"
            with self.assertRaisesMessage(CommandError, "out of date"):
                call_command("event_catalogue", "--path", str(target))
            call_command("event_catalogue", "--write", "--path", str(target), stdout=StringIO())
            out = StringIO()
            call_command("event_catalogue", "--path", str(target), stdout=out)
            self.assertIn("up to date", out.getvalue())


class AdminSwitchTests(SimpleTestCase):
    def reload_urls(self):
        import config.urls

        clear_url_caches()
        return importlib.reload(config.urls)

    def tearDown(self):
        self.reload_urls()

    def routes(self) -> list[str]:
        return [str(p.pattern) for p in self.reload_urls().urlpatterns]

    def test_admin_is_mounted_only_when_enabled_and_at_its_path(self):
        with override_settings(ADMIN_ENABLED=False):
            self.assertNotIn("admin/", self.routes())
        with override_settings(ADMIN_ENABLED=True, ADMIN_PATH="staff-tools/"):
            self.assertIn("staff-tools/", self.routes())

    def test_admin_path_must_stay_outside_the_api(self):
        environment = {**os.environ, "DJANGO_ADMIN_PATH": "api/admin", "DJANGO_READ_DOTENV": "false"}
        result = subprocess.run(
            [sys.executable, "manage.py", "check"],
            cwd=settings.BASE_DIR,
            env=environment,
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ADMIN_PATH", result.stderr)
