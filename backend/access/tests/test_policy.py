"""P3.2 to P3.5: the policy engine, scoped queries, the 404/403 rule, allowed actions, the catalogue."""

from dataclasses import dataclass
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase
from rest_framework import status

from access import selectors, services
from access.models import ParticipationProfile, Permission, SharedField
from audit.models import AuditEntry
from organizations import services as org_services
from organizations.models import Membership
from organizations.selectors import find_context
from platform_core import authorization
from platform_core.authorization import Resource
from platform_core.errors import ApiError
from platform_core.request_context import request_context
from platform_core.workspace import WorkspaceContext

from .golden import Golden, build_golden


@dataclass(frozen=True)
class Record:
    """A stand-in for a P5 record (a fixture) owned by one organization."""

    owner_organization_id: int
    event: str = "spring-cup"


class PolicyEngineTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def context(self, actor: str) -> WorkspaceContext:
        user = self.golden.users[actor]
        target = self.golden.acting[actor]
        assert target is not None
        context_id = "individual" if target == "individual" else str(self.golden.organizations[target].public_id)
        context = find_context(user, context_id)
        assert context is not None
        return context

    def test_role_grants_decide_on_the_own_organization(self):
        director, officials = self.context("director"), self.context("officials")
        self.assertTrue(selectors.can(director, "audit.view"))
        self.assertFalse(selectors.can(officials, "audit.view"))
        self.assertTrue(selectors.can(officials, "activity.view"))
        self.assertFalse(selectors.can(director, "unknown.permission"))

    def test_no_context_individual_and_legacy_roles_get_nothing(self):
        self.assertFalse(selectors.can(None, "activity.view"))
        self.assertFalse(selectors.can(self.context("individual"), "activity.view"))
        self.assertFalse(selectors.can(self.context("legacy"), "activity.view"))
        self.assertEqual(selectors.permissions_for(self.context("legacy")), frozenset())

    def test_another_organizations_record_is_invisible_without_participation(self):
        club_a = self.context("club_a")
        riverside_record = Record(owner_organization_id=self.golden.organizations["riverside"].pk)
        self.assertFalse(selectors.is_visible(club_a, riverside_record))
        self.assertFalse(selectors.can(club_a, "activity.view", riverside_record))
        self.assertEqual(selectors.visible_fields(club_a, "fixture", riverside_record, ["kickoff"]), set())
        own = Record(owner_organization_id=self.golden.organizations["club_a"].pk)
        self.assertTrue(selectors.is_visible(club_a, own))
        self.assertEqual(selectors.visible_fields(club_a, "fixture", own, ["kickoff", "notes"]), {"kickoff", "notes"})

    def test_participation_gate_opens_only_what_the_profile_grants_and_shares(self):
        riverside_pk = self.golden.organizations["riverside"].pk
        club_a_pk = self.golden.organizations["club_a"].pk

        def gate(context: WorkspaceContext, resource: Resource) -> str | None:
            # P5 will answer from EventParticipation; here Club A takes part as a club.
            event = getattr(resource, "event", None)
            return "club" if context.organization_id == club_a_pk and event == "spring-cup" else None

        services.register_participation_gate(gate)
        self.addCleanup(services.unregister_participation_gate, gate)
        club_profile = ParticipationProfile.objects.get(code="club")
        SharedField.objects.create(resource="fixture", field="kickoff", profile=club_profile)

        record = Record(owner_organization_id=riverside_pk)
        club_a, club_c = self.context("club_a"), self.context("club_c")
        self.assertTrue(selectors.is_visible(club_a, record))
        self.assertFalse(selectors.is_visible(club_c, record))
        # Visible, but the profile grants nothing yet: role AND profile must allow.
        self.assertFalse(selectors.can(club_a, "activity.view", record))
        club_profile.permissions.add(Permission.objects.get(code="activity.view"))
        self.assertTrue(selectors.can(club_a, "activity.view", record))
        self.assertFalse(selectors.can(club_c, "activity.view", record))
        self.assertEqual(selectors.visible_fields(club_a, "fixture", record, ["kickoff", "notes"]), {"kickoff"})
        self.assertEqual(selectors.visible_fields(club_c, "fixture", record, ["kickoff"]), set())
        self.assertEqual(selectors.visible_fields(None, "fixture", record, ["kickoff"]), set())

    def test_scope_to_context_keeps_only_the_own_organizations_rows(self):
        queryset = Membership.objects.all()
        riverside = selectors.scope_to_context(queryset, self.context("director"), owner_field="organization_id")
        self.assertTrue(riverside.exists())
        self.assertEqual({m.organization_id for m in riverside}, {self.golden.organizations["riverside"].pk})
        self.assertFalse(selectors.scope_to_context(queryset, self.context("individual")).exists())
        self.assertFalse(selectors.scope_to_context(queryset, None).exists())
        by_uuid = selectors.scope_to_context(
            queryset, self.context("club_c"), owner_field="organization__public_id", by_public_id=True
        )
        self.assertEqual(by_uuid.count(), 1)
        from django.db.models import Q

        widened = selectors.scope_to_context(
            queryset,
            self.context("club_c"),
            shared=Q(organization_id=self.golden.organizations["club_a"].pk),
        )
        self.assertEqual({m.organization.name for m in widened}, {"Club A", "Club C"})

    def test_kernel_hooks_use_the_engine_and_allowed_actions_keep_order(self):
        director = self.context("director")
        self.assertTrue(authorization.has_permission(director, "audit.view"))
        self.assertEqual(
            authorization.allowed_actions(
                self.context("officials"), ["audit.view", "activity.view", "organization.view"]
            ),
            ["activity.view", "organization.view"],
        )

    def test_without_an_engine_everything_is_denied(self):
        authorization.set_permission_checker(None)
        self.addCleanup(authorization.set_permission_checker, selectors.can)
        self.assertFalse(authorization.has_permission(self.context("director"), "audit.view"))

    def test_hidden_is_404_forbidden_is_403(self):
        with self.assertRaises(ApiError) as hidden:
            authorization.deny(visible=False)
        self.assertEqual((hidden.exception.status_code, hidden.exception.code), (404, "not_found"))
        with self.assertRaises(ApiError) as forbidden:
            authorization.deny(visible=True)
        self.assertEqual((forbidden.exception.status_code, forbidden.exception.code), (403, "permission_denied"))

    def test_role_permissions_are_memoised_within_one_request_only(self):
        director = self.context("director")
        with request_context("req-1"), self.assertNumQueries(1):
            selectors.permissions_for(director)
            selectors.permissions_for(director)
        services.revoke_permission("competition_director", "audit.view")
        with request_context("req-2"):
            self.assertNotIn("audit.view", selectors.permissions_for(director))
        with self.assertNumQueries(2):  # outside a request nothing is cached
            selectors.permissions_for(director)
            selectors.permissions_for(director)


class CatalogueTests(TestCase):
    golden: Golden

    @classmethod
    def setUpTestData(cls):
        cls.golden = build_golden()

    def test_roles_are_offered_only_for_their_kind_of_organization(self):
        self.assertIsNotNone(selectors.assignable_role("venue_manager", "venue"))
        self.assertIsNone(selectors.assignable_role("venue_manager", "club"))
        self.assertIsNotNone(selectors.assignable_role("organization_access_manager", "club"))
        self.assertIsNone(selectors.assignable_role("coach", "organizer"))  # legacy: not offered
        codes = [r.code for r in selectors.assignable_roles("club")]
        self.assertIn("club_coordinator", codes)
        self.assertNotIn("venue_manager", codes)
        self.assertEqual(selectors.role_names(["venue_staff", "missing"]), {"venue_staff": "Venue staff"})

    def test_memberships_and_invitations_accept_only_catalogue_roles(self):
        club = self.golden.organizations["club_a"]
        user = self.golden.users["club_b"]
        for bad in ("venue_manager", "made_up_role", "coach"):
            with self.subTest(role=bad), self.assertRaises(ApiError) as raised:
                org_services.grant_membership(user=user, organization=club, role=bad)
            self.assertEqual(raised.exception.code, "validation_error")
            self.assertIn("club_coordinator", (raised.exception.fields or {})["role"][0])
        with self.assertRaises(ApiError):
            org_services.create_invitation(organization=club, email="x@example.com", role="venue_staff")

    def test_granting_and_revoking_is_audited_and_takes_effect(self):
        self.assertTrue(services.grant_permission("venue_staff", "audit.view"))
        self.assertFalse(services.grant_permission("venue_staff", "audit.view"))
        self.assertIn("audit.view", selectors.role_permissions("venue_staff"))
        self.assertTrue(services.revoke_permission("venue_staff", "audit.view"))
        self.assertFalse(services.revoke_permission("venue_staff", "audit.view"))
        actions = list(
            AuditEntry.objects.filter(target_id="venue_staff").order_by("id").values_list("action", flat=True)
        )
        self.assertEqual(actions, ["access.permission_granted", "access.permission_revoked"])
        with self.assertRaises(ApiError) as raised:
            services.grant_permission("venue_staff", "nope.nope")
        self.assertEqual(raised.exception.status_code, status.HTTP_404_NOT_FOUND)

    def test_operator_command(self):
        out = StringIO()
        call_command("access", "roles", stdout=out)
        listing = out.getvalue()
        self.assertIn("venue_manager — Venue manager [venue]", listing)
        self.assertIn("coach (legacy, not offered)", listing)
        out = StringIO()
        call_command("access", "grant", "venue_staff", "membership.view", stdout=out)
        self.assertIn("granted", out.getvalue())
        out = StringIO()
        call_command("access", "grant", "venue_staff", "membership.view", stdout=out)
        self.assertIn("Nothing changed", out.getvalue())
        call_command("access", "revoke", "venue_staff", "membership.view", stdout=StringIO())
        with self.assertRaisesMessage(CommandError, "Unknown role"):
            call_command("access", "grant", "nobody", "membership.view")
