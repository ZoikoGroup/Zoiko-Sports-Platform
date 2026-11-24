import threading
import uuid
from datetime import timedelta

from django.db import connections, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from platform_core.concurrency import RecordGone, VersionConflict, update_versioned
from platform_core.models import VersionedSaveError
from platform_core.tests.reference.models import ReferenceItem

from .helpers import ITEMS, REFERENCE_URLS, STARTS_AT, make_user, signed_in_client


def make_item(owner, **fields) -> ReferenceItem:
    values = {"title": "Metro Cup 2027", "starts_at": STARTS_AT, "time_zone": "Europe/London", **fields}
    return ReferenceItem.objects.create(owner=owner, **values)


class BaseRecordTests(TestCase):
    def setUp(self):
        self.owner = make_user()

    def test_new_records_get_a_public_uuid_timestamps_and_version_1(self):
        first, second = make_item(self.owner), make_item(self.owner)
        self.assertIsInstance(first.public_id, uuid.UUID)
        self.assertEqual(first.public_id.version, 4)
        self.assertNotEqual(first.public_id, second.public_id)
        self.assertIsNotNone(first.created_at.tzinfo)
        self.assertEqual(first.version, 1)

    def test_an_existing_versioned_record_cannot_be_saved_directly(self):
        item = make_item(self.owner)
        item.title = "Sneaky edit"
        with self.assertRaises(VersionedSaveError):
            item.save()
        item.refresh_from_db()
        self.assertEqual(item.title, "Metro Cup 2027")


class UpdateVersionedTests(TestCase):
    def setUp(self):
        self.item = make_item(make_user())

    def test_matching_version_applies_the_change_and_increments(self):
        before = self.item.updated_at
        update_versioned(self.item, 1, {"title": "Metro Cup Final"})
        self.assertEqual(self.item.version, 2)
        stored = ReferenceItem.objects.get(pk=self.item.pk)
        self.assertEqual((stored.title, stored.version), ("Metro Cup Final", 2))
        self.assertGreater(stored.updated_at, before)

    def test_stale_version_is_a_conflict_and_changes_nothing(self):
        update_versioned(self.item, 1, {"title": "Maya's edit"})
        stale = ReferenceItem.objects.get(pk=self.item.pk)
        stale.version = 1  # what Raj loaded before Maya saved
        with self.assertRaises(VersionConflict) as raised:
            update_versioned(stale, 1, {"title": "Raj's edit"})
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.extra, {"current_version": 2})
        self.assertEqual(ReferenceItem.objects.get(pk=self.item.pk).title, "Maya's edit")

    def test_deleted_record_is_gone(self):
        ReferenceItem.objects.filter(pk=self.item.pk).delete()
        with self.assertRaises(RecordGone):
            update_versioned(self.item, 1, {"title": "x"})

    def test_platform_fields_and_empty_changes_are_refused(self):
        for field in ["version", "public_id", "created_at", "id"]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                update_versioned(self.item, 1, {field: None})
        with self.assertRaises(ValueError):
            update_versioned(self.item, 1, {})


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class VersionedApiTests(TestCase):
    client: APIClient

    def setUp(self):
        self.user = make_user()
        self.client = signed_in_client(self.user)
        self.item = make_item(self.user)
        self.url = f"{ITEMS}{self.item.public_id}/"

    def test_edit_with_current_version_succeeds(self):
        response = self.client.patch(self.url, {"version": 1, "title": "Metro Cup Final"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((response.data["title"], response.data["version"]), ("Metro Cup Final", 2))

    def test_edit_with_stale_version_is_409_with_current_version(self):
        self.client.patch(self.url, {"version": 1, "title": "Maya"}, format="json")
        response = self.client.patch(self.url, {"version": 1, "title": "Raj"}, format="json")
        self.assertEqual(response.status_code, 409)
        error = response.json()["error"]
        self.assertEqual((error["code"], error["current_version"]), ("version_conflict", 2))
        self.assertEqual(self.client.get(self.url).data["title"], "Maya")

    def test_edit_must_state_a_version(self):
        response = self.client.patch(self.url, {"title": "No version"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("version", response.json()["error"]["fields"])

    def test_records_are_addressed_by_public_id_only(self):
        self.assertEqual(self.client.get(f"{ITEMS}{self.item.pk}/").status_code, 404)  # integer ID is not a route
        self.assertEqual(self.client.get(f"{ITEMS}{uuid.uuid4()}/").status_code, 404)
        self.assertEqual(self.client.get(self.url).data["id"], str(self.item.public_id))

    def test_another_users_record_is_not_found(self):
        other = signed_in_client(make_user("raj@example.com"))
        self.assertEqual(other.get(self.url).status_code, 404)
        self.assertEqual(other.patch(self.url, {"version": 1, "title": "x"}, format="json").status_code, 404)


class ConcurrentEditTests(TransactionTestCase):
    """Real concurrent transactions on PostgreSQL: exactly one of two same-version edits wins."""

    ROUNDS = 5

    @staticmethod
    def race(item_pk: int, titles: tuple[str, ...]) -> list[str]:
        """Each title is saved from version 1 by its own thread and connection, all released at once."""
        barrier = threading.Barrier(len(titles))
        outcomes: list[str] = []
        lock = threading.Lock()

        def edit(title: str) -> None:
            try:
                copy = ReferenceItem.objects.get(pk=item_pk)
                barrier.wait(timeout=10)
                with transaction.atomic():
                    update_versioned(copy, 1, {"title": title})
                result = "ok"
            except VersionConflict:
                result = "conflict"
            finally:
                connections.close_all()
            with lock:
                outcomes.append(result)

        threads = [threading.Thread(target=edit, args=(title,)) for title in titles]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        return outcomes

    def test_two_simultaneous_edits_from_the_same_version(self):
        owner = make_user()
        for round_number in range(self.ROUNDS):
            item = make_item(owner, title=f"round {round_number}")
            outcomes = self.race(item.pk, ("Maya", "Raj"))
            with self.subTest(round=round_number):
                self.assertEqual(sorted(outcomes), ["conflict", "ok"])
                stored = ReferenceItem.objects.get(pk=item.pk)
                self.assertEqual(stored.version, 2)
                self.assertIn(stored.title, {"Maya", "Raj"})

    def test_updated_at_moves_with_each_edit(self):
        item = make_item(make_user())
        item_before = item.updated_at
        update_versioned(item, 1, {"title": "A"})
        update_versioned(item, 2, {"title": "B"})
        stored = ReferenceItem.objects.get(pk=item.pk)
        self.assertEqual(stored.version, 3)
        self.assertGreaterEqual(stored.updated_at - item_before, timedelta(0))
