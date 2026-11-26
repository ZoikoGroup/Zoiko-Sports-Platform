"""The golden event as a test fixture (backend/docs/golden-event.md), plus signed-in clients.

Riverside Invitational (organizer), Northfield Arena (venue), Clubs A and B, and
Club C, which is never invited to anything. One person per role that matters to
the permission matrix.
"""

from dataclasses import dataclass, field
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from access.models import Role
from organizations import services
from organizations.models import Membership, Organization

PASSWORD = "Correct-Horse-91"


@dataclass
class Golden:
    organizations: dict[str, Organization] = field(default_factory=dict)
    users: dict[str, Any] = field(default_factory=dict)
    # Actor name -> organization key whose workspace the actor acts in (None: no context chosen).
    acting: dict[str, str | None] = field(default_factory=dict)

    def client(self, actor: str) -> APIClient:
        """A client signed in as `actor`, acting in its workspace (anonymous for "anonymous")."""
        cache.clear()  # throttle counters
        client = APIClient()
        if actor == "anonymous":
            return client
        client.force_login(self.users[actor])
        target = self.acting.get(actor)
        if target == "individual":
            response = client.put("/api/v1/me/context/", {"context": "individual"}, format="json")
            assert response.status_code == 200, response.content
        elif target is not None:
            organization = self.organizations[target]
            response = client.put("/api/v1/me/context/", {"context": str(organization.public_id)}, format="json")
            assert response.status_code == 200, response.content
        return client


def build_golden() -> Golden:
    golden = Golden()
    for key, name, kind in [
        ("riverside", "Riverside Invitational", "organizer"),
        ("northfield", "Northfield Arena", "venue"),
        ("club_a", "Club A", "club"),
        ("club_b", "Club B", "club"),
        ("club_c", "Club C", "club"),
    ]:
        golden.organizations[key] = services.ensure_organization(name=name, kind=kind, jurisdiction="US-CA")

    def person(actor: str, *memberships: tuple[str, str], acting: str | None = None, individual: bool = False):
        user = get_user_model().objects.create_user(
            f"{actor}@golden.test",
            PASSWORD,
            full_name=actor.replace("_", " ").title(),
            has_individual_profile=individual,
        )
        for org_key, role in memberships:
            services.grant_membership(user=user, organization=golden.organizations[org_key], role=role)
        golden.users[actor] = user
        golden.acting[actor] = acting

    person("director", ("riverside", "competition_director"), acting="riverside")
    person("coordinator", ("riverside", "organizer_coordinator"), acting="riverside")
    person("officials", ("riverside", "officials_coordinator"), acting="riverside")
    person("access_manager", ("riverside", "organization_access_manager"), acting="riverside")
    person("venue_staff", ("northfield", "venue_staff"), acting="northfield")
    person("club_a", ("club_a", "club_coordinator"), acting="club_a")
    person("club_b", ("club_b", "club_coordinator"), acting="club_b")
    person("club_c", ("club_c", "club_coordinator"), acting="club_c")
    person("individual", acting="individual", individual=True)
    # Two workspaces and none chosen yet: signed in, but no context.
    person("undecided", ("club_a", "club_coordinator"), ("club_b", "club_coordinator"), acting=None)

    # A role kept from before the catalogue: not offered, grants nothing.
    Role.objects.get_or_create(
        code="coach", defaults={"name": "Coach", "is_assignable": False, "organization_kinds": []}
    )
    legacy = get_user_model().objects.create_user("legacy@golden.test", PASSWORD, full_name="Legacy Coach")
    Membership.objects.create(user=legacy, organization=golden.organizations["riverside"], role_id="coach")
    golden.users["legacy"] = legacy
    golden.acting["legacy"] = "riverside"
    return golden


ACTORS = [
    "anonymous",
    "individual",
    "undecided",
    "director",
    "coordinator",
    "officials",
    "access_manager",
    "legacy",
    "venue_staff",
    "club_a",
    "club_b",
    "club_c",
]
