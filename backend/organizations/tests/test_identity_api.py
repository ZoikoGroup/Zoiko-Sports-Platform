"""Sign-in, context choice, switching and revocation through the real HTTP API.

Mapped to the P2 exit criteria (ZS-DASH-FSD-001 tests):
  T01 secure login                    -> SecureLoginTests
  T02 the sign-in tile grants nothing -> ContextResolutionAtSignInTests
  T03 switching leaks no data         -> ContextSwitchTests
  T07/T18 removal and deactivation    -> RevocationTests (next request denied)
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.test import override_settings
from django.utils import timezone

from organizations.models import Membership, Organization

from .helpers import AUTH, ME, PASSWORD, GoldenEventTestCase, make_user

PRODUCTION_HASHERS = [
    "accounts.hashers.Argon2idHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]


class SecureLoginTests(GoldenEventTestCase):
    """T01."""

    def test_session_id_is_rotated_at_sign_in(self):
        make_user("maya@example.com", self.organizer)
        self.client.get(f"{AUTH}/session/")
        self.client.session.save()
        before = self.client.session.session_key
        self.login("maya@example.com", "organization")
        self.assertNotEqual(self.client.session.session_key, before)
        self.assertFalse(Session.objects.filter(session_key=before).exists())

    def test_session_cookie_is_http_only_and_same_site(self):
        make_user("maya@example.com", self.organizer)
        response = self.login("maya@example.com")
        cookie = response.cookies["sessionid"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")

    def test_response_exposes_public_ids_only(self):
        user = make_user("maya@example.com", self.organizer)
        data = self.login("maya@example.com", "organization").data
        self.assertEqual(data["user"]["id"], str(user.public_id))
        self.assertEqual(data["context"]["organization"]["id"], str(self.organizer.public_id))
        self.assertNotIn("organization_id", str(data))
        self.assertNotIn(PASSWORD, str(data))

    def test_sign_in_requires_csrf_and_failed_attempts_reveal_nothing(self):
        make_user("maya@example.com", self.organizer)
        no_csrf = self.client.post(f"{AUTH}/login/", {"email": "maya@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(no_csrf.json()["error"]["code"], "csrf_failed")
        wrong = self.login("maya@example.com", password="Wrong-Pass-123")
        unknown = self.login("ghost@example.com")
        self.assertEqual(wrong.data["error"]["code"], unknown.data["error"]["code"])
        self.assertFalse(self.client.get(f"{AUTH}/session/").data["authenticated"])

    @override_settings(PASSWORD_HASHERS=PRODUCTION_HASHERS)
    def test_new_passwords_use_argon2_and_older_hashes_upgrade_at_sign_in(self):
        fresh = get_user_model().objects.create_user("new@example.com", PASSWORD)
        # Argon2id at OWASP's minimum cost: 19 MiB, 2 passes, 1 lane (accounts/hashers.py).
        self.assertTrue(fresh.password.startswith("argon2$argon2id$v=19$m=19456,t=2,p=1$"), fresh.password)

        legacy = make_user("legacy@example.com", self.organizer)
        with override_settings(PASSWORD_HASHERS=PRODUCTION_HASHERS[1:]):  # as stored before P2
            legacy.set_password(PASSWORD)
            legacy.save(update_fields=["password"])
        self.assertTrue(legacy.password.startswith("pbkdf2_sha256$"))

        self.login("legacy@example.com", password="Wrong-Pass-123")
        legacy.refresh_from_db()
        self.assertTrue(legacy.password.startswith("pbkdf2_sha256$"))  # failed attempts change nothing

        self.assertEqual(self.login("legacy@example.com").status_code, 200)
        legacy.refresh_from_db()
        self.assertTrue(legacy.password.startswith("argon2$argon2id$v=19$m=19456,t=2,p=1$"))
        self.assertTrue(legacy.check_password(PASSWORD))

    @override_settings(PASSWORD_HASHERS=PRODUCTION_HASHERS)
    def test_argon2_hashes_with_heavier_parameters_are_rehashed_at_sign_in(self):
        user = make_user("heavy@example.com", self.organizer)
        with override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.Argon2PasswordHasher"]):
            user.set_password(PASSWORD)  # Django's defaults: 100 MiB, 8 lanes
            user.save(update_fields=["password"])
        self.assertIn("m=102400", user.password)
        self.assertEqual(self.login("heavy@example.com").status_code, 200)
        user.refresh_from_db()
        self.assertIn("m=19456,t=2,p=1", user.password)


class ContextResolutionAtSignInTests(GoldenEventTestCase):
    """T02: one context -> enter it; several -> choose; none -> no access. The tile only narrows."""

    def test_a_single_context_is_entered_without_a_tile(self):
        make_user("solo@example.com", self.venue, has_individual_profile=False)
        data = self.login("solo@example.com").data
        self.assertEqual(data["context_status"], "active")
        self.assertEqual(data["context"]["id"], str(self.venue.public_id))
        self.assertIsNone(data["preference_matched"])

    def test_several_contexts_without_a_matching_tile_ask_the_user_to_choose(self):
        make_user("multi@example.com", self.organizer, self.club)
        data = self.login("multi@example.com").data
        self.assertEqual(data["context_status"], "selection_required")
        self.assertIsNone(data["context"])
        self.assertEqual(len(data["contexts"]), 3)
        self.assertEqual(self.client.get(f"{ME}/context/").status_code, 403)

    def test_a_tile_matching_one_context_enters_it(self):
        make_user("multi@example.com", self.organizer, self.club)
        data = self.login("multi@example.com", "club").data
        self.assertEqual(data["context"]["organization"]["name"], "Club A")
        self.assertTrue(data["preference_matched"])

    def test_a_tile_matching_several_contexts_asks_to_choose(self):
        second = Organization.objects.create(
            name="Bayfront Cup", kind="organizer", status="active", verified_at=timezone.now()
        )
        make_user("two@example.com", self.organizer, second)
        data = self.login("two@example.com", "organization").data
        self.assertEqual(data["context_status"], "selection_required")
        self.assertTrue(data["preference_matched"])

    def test_the_tile_never_grants_a_workspace(self):
        make_user("club@example.com", self.club)
        for tile in ("organization", "venue"):
            with self.subTest(tile=tile):
                data = self.login("club@example.com", tile).data
                self.assertIsNone(data["context"])
                self.assertFalse(data["preference_matched"])
                self.assertEqual({c["account_type"] for c in data["contexts"]}, {"club", "individual"})
                self.post(f"{AUTH}/logout/", {})
        self.assertEqual(Membership.objects.filter(user__email="club@example.com").count(), 1)

    def test_a_pending_organization_grants_nothing_even_with_its_tile(self):
        pending = Organization.objects.create(name="New League", kind="organizer")  # pending by default
        make_user("new@example.com", pending)
        data = self.login("new@example.com", "organization").data
        self.assertEqual(data["context"]["account_type"], "individual")  # the only real context
        self.assertFalse(data["preference_matched"])

    def test_no_context_at_all_is_a_signed_in_no_access_state(self):
        make_user("nobody@example.com", has_individual_profile=False)
        data = self.login("nobody@example.com", "organization").data
        self.assertTrue(data["authenticated"])
        self.assertEqual((data["context_status"], data["contexts"]), ("no_access", []))
        self.assertEqual(self.client.get(f"{ME}/context/").data["error"]["code"], "context_required")


class ContextSwitchTests(GoldenEventTestCase):
    """T03: switching re-verifies, rotates the session and drops everything scoped to the old context."""

    def setUp(self):
        super().setUp()
        self.user = make_user("demo@example.com", self.organizer, self.venue)
        self.login("demo@example.com", "organization", remember=True)

    def test_switch_changes_context_and_reports_only_the_new_one(self):
        response = self.switch(str(self.venue.public_id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["context"]["organization"]["name"], "Northfield Arena")
        current = self.client.get(f"{ME}/context/").data
        self.assertEqual(current["account_type"], "venue")
        self.assertNotIn("Riverside", str(current))

    def test_switch_rotates_the_session_and_clears_context_scoped_state(self):
        session = self.client.session
        session["organizer.draft_filters"] = {"sport": "football"}  # state scoped to the old context
        session.save()
        old_key = session.session_key
        self.switch(str(self.venue.public_id))
        session = self.client.session
        self.assertNotEqual(session.session_key, old_key)
        self.assertFalse(Session.objects.filter(session_key=old_key).exists())
        self.assertNotIn("organizer.draft_filters", session)
        # Still signed in, still "keep me signed in".
        self.assertEqual(self.client.get(f"{ME}/").status_code, 200)
        self.assertFalse(session.get_expire_at_browser_close())

    def test_switch_to_someone_elses_or_unknown_context_is_not_found(self):
        for context_id in (str(self.club_c.public_id), "00000000-0000-4000-8000-000000000000", "1", "x" * 64):
            with self.subTest(context_id=context_id):
                response = self.switch(context_id)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data["error"]["code"], "context_not_found")
        self.assertEqual(self.client.get(f"{ME}/context/").data["account_type"], "organization")

    def test_switch_validates_input_and_needs_sign_in_and_csrf(self):
        self.assertEqual(self.put(f"{ME}/context/", {}).data["error"]["code"], "validation_error")
        no_csrf = self.client.put(f"{ME}/context/", {"context": "individual"}, format="json")
        self.assertEqual(no_csrf.data["error"]["code"], "csrf_failed")
        self.post(f"{AUTH}/logout/", {})
        self.assertEqual(self.switch("individual").status_code, 401)

    def test_context_list_marks_the_active_one(self):
        data = self.client.get(f"{ME}/contexts/").data
        self.assertEqual(data["active"], str(self.organizer.public_id))
        self.assertEqual([c["account_type"] for c in data["contexts"]], ["organization", "venue", "individual"])

    def test_reading_the_context_is_one_query_beyond_the_session(self):
        self.client.get(f"{ME}/context/")  # warm the CSRF cookie path
        # session + user + context resolution.
        with self.assertNumQueries(3):
            self.assertEqual(self.client.get(f"{ME}/context/").status_code, 200)


class RevocationTests(GoldenEventTestCase):
    """A removed member, a suspended organization or a deactivated account is denied on the next request."""

    def setUp(self):
        super().setUp()
        self.user = make_user("maya@example.com", self.organizer)
        self.login("maya@example.com", "organization")
        self.assertEqual(self.client.get(f"{ME}/context/").status_code, 200)

    def assert_context_ended(self):
        response = self.client.get(f"{ME}/context/")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"]["code"], "context_required")
        me = self.client.get(f"{ME}/").data
        self.assertIsNone(me["context"])
        self.assertTrue(me["context_ended"])
        self.assertNotIn(str(self.organizer.public_id), [c["id"] for c in me["contexts"]])
        # It cannot be chosen again either.
        self.assertEqual(self.switch(str(self.organizer.public_id)).status_code, 404)

    def test_revoked_membership(self):
        Membership.objects.filter(user=self.user).update(status=Membership.Status.REVOKED)
        self.assert_context_ended()

    def test_suspended_membership(self):
        Membership.objects.filter(user=self.user).update(status=Membership.Status.SUSPENDED)
        self.assert_context_ended()

    def test_deleted_membership(self):
        Membership.objects.filter(user=self.user).delete()
        self.assert_context_ended()

    def test_membership_past_its_end_date(self):
        Membership.objects.filter(user=self.user).update(valid_to=timezone.now() - timedelta(seconds=1))
        self.assert_context_ended()

    def test_suspended_organization(self):
        Organization.objects.filter(pk=self.organizer.pk).update(status=Organization.Status.SUSPENDED)
        self.assert_context_ended()

    def test_choosing_another_context_clears_the_ended_notice(self):
        Membership.objects.filter(user=self.user).update(status=Membership.Status.REVOKED)
        self.client.get(f"{ME}/")
        data = self.switch("individual").data
        self.assertEqual(data["context"]["id"], "individual")
        self.assertFalse(data["context_ended"])

    def test_deactivated_account_loses_its_session_for_good(self):
        """T18."""
        session_key = self.client.session.session_key
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.client.get(f"{ME}/").status_code, 401)
        self.assertFalse(Session.objects.filter(session_key=session_key).exists())
        # Reactivating the account does not bring the old session back.
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=True)
        self.assertEqual(self.client.get(f"{ME}/").status_code, 401)

    def test_password_reset_elsewhere_ends_the_session(self):
        user = get_user_model().objects.get(pk=self.user.pk)
        user.set_password("Brand-New-Pass-77")
        user.save()
        self.assertEqual(self.client.get(f"{ME}/").status_code, 401)
