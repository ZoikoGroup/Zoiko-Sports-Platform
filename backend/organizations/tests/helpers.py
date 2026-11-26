"""Fixtures for the identity and organization tests: the golden-event parties."""

from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Membership, Organization

PASSWORD = "Correct-Horse-91"
AUTH = "/api/v1/auth"
ME = "/api/v1/me"
INVITATIONS = "/api/v1/invitations"


def make_organization(name: str, kind: str, status: str = Organization.Status.ACTIVE) -> Organization:
    verified_at = timezone.now() if status == Organization.Status.ACTIVE else None
    return Organization.objects.create(name=name, kind=kind, status=status, verified_at=verified_at)


def make_user(email: str, *organizations: Organization, role: str = "coordinator", **extra):
    user = get_user_model().objects.create_user(email, PASSWORD, full_name="Test Person", **extra)
    for organization in organizations:
        Membership.objects.create(user=user, organization=organization, role=role)
    return user


def csrf_client() -> APIClient:
    return APIClient(enforce_csrf_checks=True)


class ApiClientMixin:
    """CSRF-enforcing JSON calls, as the browser makes them."""

    # An APIClient (typed Any: Django's TestCase declares `client` as its own Client).
    client: Any

    def csrf(self) -> dict[str, Any]:
        if "csrftoken" not in self.client.cookies:
            self.client.get(f"{AUTH}/csrf/")
        return {"HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value}

    def post(self, url: str, data: dict):
        return self.client.post(url, data, format="json", **self.csrf())

    def put(self, url: str, data: dict):
        return self.client.put(url, data, format="json", **self.csrf())

    def login(self, email: str, account_type: str | None = None, remember: bool = False, password: str = PASSWORD):
        payload: dict = {"email": email, "password": password, "remember": remember}
        if account_type is not None:
            payload["account_type"] = account_type
        return self.post(f"{AUTH}/login/", payload)

    def switch(self, context_id: str):
        return self.put(f"{ME}/context/", {"context": context_id})


class GoldenEventTestCase(ApiClientMixin, TestCase):
    """Riverside Invitational (organizer), Northfield Arena (venue), Club A and an unrelated Club C."""

    def setUp(self) -> None:
        cache.clear()  # throttle counters
        self.client = csrf_client()
        self.organizer = make_organization("Riverside Invitational", Organization.Kind.ORGANIZER)
        self.venue = make_organization("Northfield Arena", Organization.Kind.VENUE)
        self.club = make_organization("Club A", Organization.Kind.CLUB)
        self.club_c = make_organization("Club C", Organization.Kind.CLUB)
