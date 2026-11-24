"""Shared helpers for the kernel tests."""

import logging
from datetime import UTC, datetime

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from platform_core.logging import RequestContextFilter

REFERENCE_URLS = "platform_core.tests.reference.api.urls"
ITEMS = "/api/v1/reference/items/"
STARTS_AT = datetime(2027, 6, 12, 18, 0, tzinfo=UTC)


def make_user(email: str = "maya@example.com"):
    return get_user_model().objects.create_user(email, "Correct-Horse-91", full_name="Maya Coordinator")


def signed_in_client(user) -> APIClient:
    client = APIClient()
    client.force_login(user)
    return client


def item_payload(**overrides):
    payload = {
        "title": "Metro Cup 2027",
        "status": "draft",
        "starts_at": "2027-06-12T18:00:00Z",
        "time_zone": "Europe/London",
    }
    payload.update(overrides)
    return payload


class CapturingHandler(logging.Handler):
    """Collects records after the platform's request-context filter has run (as the console handler does)."""

    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.addFilter(RequestContextFilter())
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


class capture_logs:
    """Context manager attaching a CapturingHandler to the root logger."""

    def __enter__(self) -> CapturingHandler:
        self.handler = CapturingHandler()
        self.root = logging.getLogger()
        self.previous_level = self.root.level
        self.root.addHandler(self.handler)
        self.root.setLevel(logging.DEBUG)
        return self.handler

    def __exit__(self, *exc: object) -> None:
        self.root.removeHandler(self.handler)
        self.root.setLevel(self.previous_level)
