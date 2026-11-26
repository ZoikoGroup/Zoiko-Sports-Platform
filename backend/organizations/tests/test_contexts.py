"""Context resolution: which workspaces an account may act in, decided only by verified data."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from organizations.models import Membership, Organization
from organizations.selectors import eligible_contexts, find_context
from platform_core.workspace import INDIVIDUAL_CONTEXT_ID

from .helpers import make_organization, make_user


class EligibleContextTests(TestCase):
    def setUp(self):
        self.organizer = make_organization("Riverside Invitational", Organization.Kind.ORGANIZER)
        self.venue = make_organization("Northfield Arena", Organization.Kind.VENUE)
        self.club = make_organization("Club A", Organization.Kind.CLUB)

    def ids(self, user):
        return [c.id for c in eligible_contexts(user)]

    def test_active_memberships_and_individual_profile_in_tile_order(self):
        user = make_user("multi@example.com", self.club, self.venue, self.organizer, role="director")
        contexts = eligible_contexts(user)
        self.assertEqual([c.account_type for c in contexts], ["organization", "venue", "club", "individual"])
        organizer = contexts[0]
        self.assertEqual(organizer.id, str(self.organizer.public_id))
        self.assertEqual(
            (organizer.organization_name, organizer.organization_kind), ("Riverside Invitational", "organizer")
        )
        self.assertEqual(organizer.role, "director")
        self.assertEqual(organizer.organization_id, self.organizer.pk)
        self.assertTrue(contexts[-1].is_individual)

    def test_two_organizations_of_one_kind_are_two_contexts_sorted_by_name(self):
        second = make_organization("Bayfront Cup", Organization.Kind.ORGANIZER)
        user = make_user("two@example.com", self.organizer, second)
        self.assertEqual(
            [c.organization_name for c in eligible_contexts(user)], ["Bayfront Cup", "Riverside Invitational", ""]
        )

    def test_inactive_memberships_grant_nothing(self):
        user = make_user("m@example.com", self.organizer)
        for status in (Membership.Status.SUSPENDED, Membership.Status.REVOKED, Membership.Status.INVITED):
            with self.subTest(status=status):
                Membership.objects.filter(user=user).update(status=status)
                self.assertEqual(self.ids(user), [INDIVIDUAL_CONTEXT_ID])

    def test_pending_or_suspended_organizations_grant_nothing(self):
        user = make_user("o@example.com", self.organizer)
        for status in (Organization.Status.PENDING, Organization.Status.SUSPENDED):
            with self.subTest(status=status):
                Organization.objects.filter(pk=self.organizer.pk).update(status=status)
                self.assertEqual(self.ids(user), [INDIVIDUAL_CONTEXT_ID])

    def test_validity_window_is_respected(self):
        user = make_user("w@example.com", self.venue)
        now = timezone.now()
        membership = Membership.objects.get(user=user)
        for valid_from, valid_to, granted in (
            (now + timedelta(days=1), None, False),
            (None, now - timedelta(seconds=1), False),
            (now - timedelta(days=1), now + timedelta(days=1), True),
        ):
            with self.subTest(valid_from=valid_from, valid_to=valid_to):
                Membership.objects.filter(pk=membership.pk).update(valid_from=valid_from, valid_to=valid_to)
                self.assertEqual(str(self.venue.public_id) in self.ids(user), granted)

    def test_individual_workspace_follows_the_profile_flag(self):
        user = make_user("noind@example.com", self.club, has_individual_profile=False)
        self.assertEqual(self.ids(user), [str(self.club.public_id)])
        self.assertIsNone(find_context(user, INDIVIDUAL_CONTEXT_ID))

    def test_inactive_account_has_no_context(self):
        user = make_user("gone@example.com", self.club, is_active=False)
        self.assertEqual(eligible_contexts(user), [])
        self.assertIsNone(find_context(user, str(self.club.public_id)))

    def test_find_context_accepts_only_the_users_own_contexts(self):
        user = make_user("f@example.com", self.club)
        own = find_context(user, str(self.club.public_id))
        assert own is not None
        self.assertEqual(own.organization_id, self.club.pk)
        self.assertIsNone(find_context(user, str(self.venue.public_id)))  # someone else's organization
        for garbage in ("", "not-a-uuid", "00000000-0000-0000-0000-000000000000", str(self.club.pk)):
            with self.subTest(garbage=garbage):
                self.assertIsNone(find_context(user, garbage))

    def test_find_context_is_a_single_query(self):
        user = make_user("q@example.com", self.club)
        with self.assertNumQueries(1):
            find_context(user, str(self.club.public_id))
        with self.assertNumQueries(0):
            find_context(user, INDIVIDUAL_CONTEXT_ID)
