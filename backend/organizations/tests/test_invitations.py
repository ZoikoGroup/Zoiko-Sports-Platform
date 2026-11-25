"""Invitations: single-use, expiring, hashed, bound to one email address."""

import re
import threading
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone

from organizations import services
from organizations.models import Invitation, Membership, Organization
from organizations.tokens import hash_token
from platform_core.errors import ApiError

from .helpers import (
    AUTH,
    INVITATIONS,
    ME,
    ApiClientMixin,
    GoldenEventTestCase,
    csrf_client,
    make_organization,
    make_user,
)


def token_from_email() -> str:
    match = re.search(r"/invitations/accept#token=([\w-]+)", str(mail.outbox[-1].body))
    assert match, "no invitation link in the email"
    return match.group(1)


class InvitationIssueTests(GoldenEventTestCase):
    def invite(self, email="casey@example.com", role="club_coordinator", organization=None):
        with self.captureOnCommitCallbacks(execute=True):
            return services.create_invitation(organization=organization or self.club, email=email, role=role)

    def test_invitation_email_carries_the_token_only_in_the_link_fragment(self):
        invitation, token = self.invite(email="  Casey@Example.com ")
        self.assertEqual(invitation.email, "casey@example.com")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["casey@example.com"])
        self.assertIn("Club A", message.subject)
        self.assertEqual(token_from_email(), token)
        self.assertNotIn("?token=", message.body)

    def test_only_a_hash_of_the_token_is_stored(self):
        invitation, token = self.invite()
        self.assertEqual(invitation.token_hash, hash_token(token))
        stored_row = Invitation.objects.filter(pk=invitation.pk).values().get()
        self.assertNotIn(token, str(stored_row))

    def test_default_expiry_is_seven_days(self):
        invitation, _ = self.invite()
        self.assertAlmostEqual(invitation.expires_at - timezone.now(), timedelta(days=7), delta=timedelta(seconds=30))

    def test_reinviting_replaces_the_earlier_link(self):
        first, first_token = self.invite()
        second, _ = self.invite(role="club_manager")
        first.refresh_from_db()
        self.assertEqual(first.status, Invitation.Status.REVOKED)
        self.assertEqual(Invitation.objects.filter(status=Invitation.Status.PENDING).get(), second)
        user = make_user("casey@example.com")
        with self.assertRaises(ApiError) as raised:
            services.accept_invitation(token=first_token, user=user)
        self.assertEqual(raised.exception.code, "invitation_invalid")

    def test_unverified_or_suspended_organizations_cannot_invite(self):
        pending = make_organization("New League", Organization.Kind.ORGANIZER, status=Organization.Status.PENDING)
        for organization in (pending, self.club_c):
            if organization is self.club_c:
                Organization.objects.filter(pk=organization.pk).update(status=Organization.Status.SUSPENDED)
                organization.refresh_from_db()
            with self.subTest(status=organization.status), self.assertRaises(ApiError) as raised:
                services.create_invitation(organization=organization, email="x@example.com", role="member")
            self.assertEqual(raised.exception.code, "organization_unavailable")

    def test_role_and_email_are_validated(self):
        for email, role, field in (
            ("x@example.com", "Club Boss!", "role"),
            ("x@example.com", "a", "role"),
            ("not-an-email", "member", "email"),
        ):
            with self.subTest(email=email, role=role), self.assertRaises(ApiError) as raised:
                services.create_invitation(organization=self.club, email=email, role=role)
            self.assertIn(field, raised.exception.fields or {})


class InvitationApiTests(GoldenEventTestCase):
    def setUp(self):
        super().setUp()
        with self.captureOnCommitCallbacks(execute=True):
            self.invitation, self.token = services.create_invitation(
                organization=self.club, email="casey@example.com", role="club_coordinator"
            )

    def accept(self, token=None):
        return self.post(f"{INVITATIONS}/accept/", {"token": token or self.token})

    def test_preview_shows_what_is_offered_without_signing_in(self):
        data = self.post(f"{INVITATIONS}/preview/", {"token": self.token}).data
        self.assertEqual(data["organization"], {"name": "Club A", "kind": "club"})
        self.assertEqual((data["account_type"], data["role"], data["state"]), ("club", "club_coordinator", "pending"))
        self.assertEqual(data["email"], "c****@example.com")

    def test_preview_of_an_unknown_token_is_invalid(self):
        response = self.post(f"{INVITATIONS}/preview/", {"token": "made-up"})
        self.assertEqual((response.status_code, response.data["error"]["code"]), (400, "invitation_invalid"))

    def test_preview_and_accept_need_csrf(self):
        response = self.client.post(f"{INVITATIONS}/preview/", {"token": self.token}, format="json")
        self.assertEqual(response.json()["error"]["code"], "csrf_failed")

    def test_accept_requires_sign_in(self):
        self.assertEqual(self.accept().status_code, 401)

    def test_accept_joins_and_enters_the_workspace(self):
        user = make_user("casey@example.com")
        self.login("casey@example.com")
        data = self.accept().data
        self.assertEqual(data["context"]["organization"]["name"], "Club A")
        self.assertEqual(data["context"]["role"], "club_coordinator")
        membership = Membership.objects.get(user=user, organization=self.club)
        self.assertEqual(membership.status, Membership.Status.ACTIVE)
        self.invitation.refresh_from_db()
        self.assertEqual((self.invitation.status, self.invitation.accepted_by), (Invitation.Status.ACCEPTED, user))
        self.assertEqual(self.client.get(f"{ME}/context/").data["account_type"], "club")

    def test_an_invitation_works_once(self):
        make_user("casey@example.com")
        self.login("casey@example.com")
        self.assertEqual(self.accept().status_code, 200)
        again = self.accept()
        self.assertEqual((again.status_code, again.data["error"]["code"]), (409, "invitation_used"))
        preview = self.post(f"{INVITATIONS}/preview/", {"token": self.token}).data
        self.assertEqual(preview["state"], "accepted")

    def test_expired_invitation_is_refused(self):
        Invitation.objects.filter(pk=self.invitation.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        make_user("casey@example.com")
        self.login("casey@example.com")
        self.assertEqual(self.post(f"{INVITATIONS}/preview/", {"token": self.token}).data["state"], "expired")
        response = self.accept()
        self.assertEqual(response.data["error"]["code"], "invitation_expired")
        self.assertFalse(Membership.objects.filter(organization=self.club).exists())

    def test_revoked_invitation_or_suspended_organization_is_invalid(self):
        make_user("casey@example.com")
        self.login("casey@example.com")
        Organization.objects.filter(pk=self.club.pk).update(status=Organization.Status.SUSPENDED)
        self.assertEqual(self.accept().data["error"]["code"], "invitation_invalid")
        Organization.objects.filter(pk=self.club.pk).update(status=Organization.Status.ACTIVE)
        services.revoke_invitation(self.invitation)
        self.assertEqual(self.accept().data["error"]["code"], "invitation_invalid")
        self.assertEqual(self.post(f"{INVITATIONS}/preview/", {"token": self.token}).status_code, 400)

    def test_another_account_cannot_accept_it(self):
        make_user("someone.else@example.com")
        self.login("someone.else@example.com")
        response = self.accept()
        self.assertEqual((response.status_code, response.data["error"]["code"]), (403, "invitation_email_mismatch"))
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, Invitation.Status.PENDING)  # still usable by the right person

    def test_existing_active_member_is_told_so(self):
        make_user("casey@example.com", self.club)
        self.login("casey@example.com")
        response = self.accept()
        self.assertEqual((response.status_code, response.data["error"]["code"]), (409, "already_member"))

    def test_a_removed_member_can_be_invited_back_with_the_new_role(self):
        user = make_user("casey@example.com", self.club, role="volunteer")
        Membership.objects.filter(user=user).update(status=Membership.Status.REVOKED, valid_to=timezone.now())
        self.login("casey@example.com")
        self.assertEqual(self.accept().status_code, 200)
        membership = Membership.objects.get(user=user, organization=self.club)
        self.assertEqual(
            (membership.status, membership.role, membership.valid_to), ("active", "club_coordinator", None)
        )

    def test_accepting_rotates_the_session(self):
        make_user("casey@example.com")
        self.login("casey@example.com")
        before = self.client.session.session_key
        self.accept()
        self.assertNotEqual(self.client.session.session_key, before)


class InvitationConcurrencyTests(ApiClientMixin, TransactionTestCase):
    """Real concurrent transactions on PostgreSQL."""

    def setUp(self):
        cache.clear()
        self.club = make_organization("Club A", Organization.Kind.CLUB)

    @staticmethod
    def race(workers):
        barrier = threading.Barrier(len(workers))
        results: list = [None] * len(workers)

        def run(index, work):
            try:
                barrier.wait()
                results[index] = work()
            except Exception as exc:
                results[index] = exc
            finally:
                connections.close_all()

        threads = [threading.Thread(target=run, args=(i, w)) for i, w in enumerate(workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        return results

    def test_simultaneous_accepts_of_one_invitation_succeed_exactly_once(self):
        for round_number in range(5):
            email = f"casey{round_number}@example.com"
            user = make_user(email)
            _, token = services.create_invitation(organization=self.club, email=email, role="club_coordinator")
            results = self.race([lambda t=token, u=user: services.accept_invitation(token=t, user=u)] * 4)
            successes = [r for r in results if isinstance(r, Membership)]
            failures = [r for r in results if isinstance(r, ApiError)]
            self.assertEqual(len(successes), 1, results)
            self.assertEqual({f.code for f in failures}, {"invitation_used"})
            self.assertEqual(Membership.objects.filter(user=user).count(), 1)

    def test_simultaneous_invitations_to_one_address_leave_one_valid_link(self):
        results = self.race(
            [lambda: services.create_invitation(organization=self.club, email="x@example.com", role="member")] * 4
        )
        self.assertTrue(all(isinstance(r, tuple) for r in results), results)
        pending = Invitation.objects.get(status=Invitation.Status.PENDING)  # exactly one
        valid_token = next(token for invitation, token in results if invitation.pk == pending.pk)
        user = make_user("x@example.com")
        self.assertEqual(services.accept_invitation(token=valid_token, user=user).organization, self.club)

    def test_two_browsers_accepting_through_the_api(self):
        user = make_user("casey@example.com")
        _, token = services.create_invitation(organization=self.club, email=user.email, role="club_coordinator")
        clients = []
        for _ in range(2):
            helper = ApiClientMixin()
            helper.client = csrf_client()
            helper.login("casey@example.com")
            clients.append(helper)
        results = self.race([lambda h=h: h.post(f"{INVITATIONS}/accept/", {"token": token}) for h in clients])
        self.assertEqual(sorted(r.status_code for r in results), [200, 409])
        self.assertEqual(Membership.objects.filter(user=user).count(), 1)
        # Each browser still has a valid session afterwards.
        for helper in clients:
            self.assertEqual(helper.client.get(f"{AUTH}/session/").data["authenticated"], True)
