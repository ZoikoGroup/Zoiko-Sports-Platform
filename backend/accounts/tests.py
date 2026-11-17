import os
import re
from io import StringIO
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from .models import Membership, Organization, User

PASSWORD = "Correct-Horse-91"
API = "/api/v1/auth"


class AuthTestCase(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters
        self.client = APIClient(enforce_csrf_checks=True)
        self.organizer = Organization.objects.create(name="Riverside Invitational", kind=Organization.Kind.ORGANIZER)
        self.venue = Organization.objects.create(name="Northfield Arena", kind=Organization.Kind.VENUE)
        self.club = Organization.objects.create(name="Club A", kind=Organization.Kind.CLUB)

    def make_user(self, email, *orgs, **extra):
        user = User.objects.create_user(email, PASSWORD, full_name="Test User", **extra)
        for org in orgs:
            Membership.objects.create(user=user, organization=org, role="coordinator")
        return user

    def csrf(self):
        self.client.get(f"{API}/csrf/")
        return {"HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value}

    def post(self, path, data):
        return self.client.post(f"{API}/{path}/", data, format="json", **self.csrf())

    def login(self, email, account_type, password=PASSWORD, remember=False):
        return self.post("login", {"email": email, "password": password, "account_type": account_type, "remember": remember})


class LoginWorkspaceTests(AuthTestCase):
    def test_each_of_the_four_workspaces_signs_in(self):
        self.make_user("multi@example.com", self.organizer, self.venue, self.club)
        expected = {"organization": self.organizer.pk, "venue": self.venue.pk, "club": self.club.pk, "individual": None}
        for account_type, org_id in expected.items():
            with self.subTest(account_type=account_type):
                response = self.login("multi@example.com", account_type)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["account_type"], account_type)
                self.assertEqual(response.data["active_organization_id"], org_id)
                session = self.client.get(f"{API}/session/").data
                self.assertTrue(session["authenticated"])
                self.assertEqual(session["account_type"], account_type)
                self.post("logout", {})

    def test_workspace_without_membership_is_refused(self):
        self.make_user("club@example.com", self.club)
        response = self.login("club@example.com", "venue")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"]["code"], "workspace_unavailable")
        self.assertEqual(response.data["error"]["fields"]["available_account_types"], ["club", "individual"])
        self.assertFalse(self.client.get(f"{API}/session/").data["authenticated"])

    def test_suspended_membership_does_not_grant_workspace(self):
        user = self.make_user("old@example.com", self.venue)
        Membership.objects.filter(user=user).update(status=Membership.Status.REVOKED)
        self.assertEqual(self.login("old@example.com", "venue").status_code, 403)

    def test_wrong_password_and_unknown_email_get_the_same_error(self):
        self.make_user("known@example.com")
        wrong = self.login("known@example.com", "individual", password="nope-nope-nope")
        unknown = self.login("ghost@example.com", "individual")
        self.assertEqual(wrong.status_code, unknown.status_code)
        self.assertEqual(wrong.data, unknown.data)
        self.assertEqual(wrong.data["error"]["code"], "invalid_credentials")

    def test_email_is_case_insensitive(self):
        self.make_user("case@example.com")
        self.assertEqual(self.login("CASE@Example.com", "individual").status_code, 200)

    def test_unverified_account_is_told_to_verify(self):
        self.make_user("new@example.com", is_active=False)
        response = self.login("new@example.com", "individual")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"]["code"], "email_not_verified")

    def test_remember_me_controls_session_lifetime(self):
        self.make_user("r@example.com")
        self.login("r@example.com", "individual", remember=False)
        self.assertEqual(self.client.session.get_expire_at_browser_close(), True)
        self.post("logout", {})
        self.login("r@example.com", "individual", remember=True)
        self.assertEqual(self.client.session.get_expire_at_browser_close(), False)

    def test_login_requires_csrf_token(self):
        self.make_user("csrf@example.com")
        response = self.client.post(
            f"{API}/login/",
            {"email": "csrf@example.com", "password": PASSWORD, "account_type": "individual"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_account_type_is_a_validation_error(self):
        response = self.login("x@example.com", "admin")
        self.assertEqual(response.status_code, 400)
        self.assertIn("account_type", response.data["error"]["fields"])

    @patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"auth": "3/min"})
    def test_login_is_rate_limited(self):
        for _ in range(3):
            self.login("ghost@example.com", "individual")
        response = self.login("ghost@example.com", "individual")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data["error"]["code"], "rate_limited")


class RegistrationTests(AuthTestCase):
    def link_params(self):
        body = mail.outbox[-1].body
        return dict(re.findall(r"[?&](uid|token)=([^&\s]+)", body))

    def test_register_verify_then_sign_in(self):
        response = self.post("register", {"full_name": "Pat Doe", "email": "pat@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.login("pat@example.com", "individual").data["error"]["code"], "email_not_verified")

        params = self.link_params()
        self.assertEqual(self.post("verify-email", params).status_code, 200)
        self.assertEqual(self.post("verify-email", params).status_code, 400)  # single use
        self.assertEqual(self.login("pat@example.com", "individual").status_code, 200)

    def test_register_existing_email_is_indistinguishable(self):
        self.make_user("taken@example.com")
        response = self.post("register", {"full_name": "X", "email": "taken@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 202)
        self.assertIn("already have", mail.outbox[-1].subject)
        self.assertEqual(User.objects.filter(email="taken@example.com").count(), 1)

    def test_weak_password_is_rejected_with_field_error(self):
        response = self.post("register", {"full_name": "X", "email": "weak@example.com", "password": "password"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["error"]["fields"])


class PasswordResetTests(AuthTestCase):
    def test_reset_flow(self):
        self.make_user("reset@example.com")
        self.assertEqual(self.post("password-reset", {"email": "reset@example.com"}).status_code, 202)
        params = dict(re.findall(r"[?&](uid|token)=([^&\s]+)", mail.outbox[-1].body))

        weak = self.post("password-reset/confirm", {**params, "new_password": "123"})
        self.assertEqual(weak.status_code, 400)
        self.assertIn("new_password", weak.data["error"]["fields"])

        self.assertEqual(self.post("password-reset/confirm", {**params, "new_password": "Brand-New-Pass-77"}).status_code, 200)
        self.assertEqual(self.post("password-reset/confirm", {**params, "new_password": "Another-Pass-88"}).status_code, 400)
        self.assertEqual(self.login("reset@example.com", "individual", password="Brand-New-Pass-77").status_code, 200)

    def test_unknown_email_gets_same_response_and_no_mail(self):
        response = self.post("password-reset", {"email": "nobody@example.com"})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(len(mail.outbox), 0)


class ConfigAndProviderTests(AuthTestCase):
    def test_config_lists_four_account_types_and_providers(self):
        data = self.client.get(f"{API}/config/").data
        self.assertEqual([t["id"] for t in data["account_types"]], ["organization", "venue", "club", "individual"])
        self.assertEqual({p["id"] for p in data["providers"]}, {"google", "microsoft", "apple", "sso"})

    def test_unconfigured_provider_reports_unavailable(self):
        response = self.post("providers/google/start", {})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "provider_unavailable")


class SeedDemoCommandTests(TestCase):
    def run_seed(self, **env):
        out = StringIO()
        with patch.dict(os.environ, env, clear=False):
            call_command("seed_demo", stdout=out)
        return out.getvalue()

    @override_settings(DEBUG=True)
    def test_seeds_all_four_workspaces_without_printing_the_password(self):
        output = self.run_seed(ZS_DEMO_PASSWORD=PASSWORD)
        self.assertNotIn(PASSWORD, output)
        demo = User.objects.get(email="demo@zoikosports.test")
        self.assertTrue(demo.check_password(PASSWORD))
        self.assertEqual(demo.available_account_types(), ["organization", "venue", "club", "individual"])

    @override_settings(DEBUG=True)
    def test_requires_a_password_from_the_environment(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ZS_DEMO_PASSWORD", None)
            with self.assertRaisesMessage(CommandError, "ZS_DEMO_PASSWORD"):
                call_command("seed_demo", stdout=StringIO())

    @override_settings(DEBUG=True)
    def test_rejects_a_weak_password(self):
        with self.assertRaisesMessage(CommandError, "too weak"):
            self.run_seed(ZS_DEMO_PASSWORD="password")

    @override_settings(DEBUG=False)
    def test_refuses_outside_debug_unless_explicitly_allowed(self):
        with patch.dict(os.environ, {"ZS_ALLOW_DEMO_SEED": ""}):
            with self.assertRaises(CommandError):
                self.run_seed(ZS_DEMO_PASSWORD=PASSWORD)
        self.run_seed(ZS_DEMO_PASSWORD=PASSWORD, ZS_ALLOW_DEMO_SEED="true")
        self.assertTrue(User.objects.filter(email="venue@zoikosports.test").exists())
