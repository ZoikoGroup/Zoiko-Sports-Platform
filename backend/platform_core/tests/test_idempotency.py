import threading
from datetime import timedelta
from io import StringIO

from django.core.management import CommandError, call_command
from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from platform_core.idempotency import idempotent, purge_expired
from platform_core.models import IdempotencyRecord
from platform_core.tests.reference.models import ReferenceItem

from .helpers import ITEMS, REFERENCE_URLS, item_payload, make_user, signed_in_client


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class IdempotentCreateTests(TestCase):
    client: APIClient

    def setUp(self):
        self.user = make_user()
        self.client = signed_in_client(self.user)

    def create(self, key, client=None, **overrides):
        headers = {"HTTP_IDEMPOTENCY_KEY": key} if key is not None else {}
        return (client or self.client).post(ITEMS, item_payload(**overrides), format="json", **headers)

    def test_retry_with_the_same_key_returns_the_original_result(self):
        first = self.create("submit-1")
        retry = self.create("submit-1")
        self.assertEqual((first.status_code, retry.status_code), (201, 201))
        self.assertEqual(retry.json(), first.json())
        self.assertEqual(retry["Idempotent-Replayed"], "true")
        self.assertFalse(first.has_header("Idempotent-Replayed"))
        self.assertEqual(ReferenceItem.objects.count(), 1)
        self.assertEqual(IdempotencyRecord.objects.count(), 1)

    def test_different_keys_create_different_records(self):
        self.create("submit-1")
        self.create("submit-2")
        self.assertEqual(ReferenceItem.objects.count(), 2)

    def test_same_key_with_a_different_body_is_422(self):
        self.create("submit-1")
        response = self.create("submit-1", title="Another competition")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "idempotency_key_reused")
        self.assertEqual(ReferenceItem.objects.count(), 1)

    def test_key_is_required_on_creates(self):
        response = self.create(None)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "idempotency_key_required")
        self.assertEqual(ReferenceItem.objects.count(), 0)

    def test_malformed_keys_are_rejected(self):
        for key in ["has space", "x" * 256, "tab\tkey"]:
            with self.subTest(key=key):
                response = self.create(key)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"]["code"], "idempotency_key_invalid")
        self.assertEqual(ReferenceItem.objects.count(), 0)

    def test_keys_belong_to_one_user(self):
        mine = self.create("shared-key")
        raj = signed_in_client(make_user("raj@example.com"))
        theirs = self.create("shared-key", client=raj)
        self.assertEqual(theirs.status_code, 201)
        self.assertFalse(theirs.has_header("Idempotent-Replayed"))
        self.assertNotEqual(theirs.json()["id"], mine.json()["id"])
        self.assertEqual(ReferenceItem.objects.count(), 2)

    def test_failed_requests_are_not_stored_so_a_corrected_retry_works(self):
        failed = self.create("submit-1", time_zone="Mars/Olympus")
        self.assertEqual(failed.status_code, 400)
        self.assertEqual(IdempotencyRecord.objects.count(), 0)
        corrected = self.create("submit-1")
        self.assertEqual(corrected.status_code, 201)
        self.assertEqual(ReferenceItem.objects.count(), 1)

    def test_an_expired_key_acts_again(self):
        self.create("submit-1")
        IdempotencyRecord.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        again = self.create("submit-1")
        self.assertEqual(again.status_code, 201)
        self.assertFalse(again.has_header("Idempotent-Replayed"))
        self.assertEqual(ReferenceItem.objects.count(), 2)
        self.assertEqual(IdempotencyRecord.objects.count(), 1)

    def test_storing_removes_the_users_expired_records(self):
        self.create("old")
        IdempotencyRecord.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.create("new")
        self.assertEqual(list(IdempotencyRecord.objects.values_list("key", flat=True)), ["new"])

    @override_settings(IDEMPOTENCY_TTL=timedelta(hours=2))
    def test_records_expire_after_the_configured_ttl(self):
        self.create("submit-1")
        record = IdempotencyRecord.objects.get()
        self.assertAlmostEqual(
            (record.expires_at - record.created_at).total_seconds(), timedelta(hours=2).total_seconds(), delta=1
        )

    def test_anonymous_callers_are_refused(self):
        response = self.create("submit-1", client=APIClient())
        self.assertEqual(response.status_code, 401)


class OptionalKeyView(APIView):
    @idempotent("tests.optional", required=False)
    def post(self, request):
        return Response({"echo": request.data.get("value")}, status=201)


class DecoratorTests(TestCase):
    def test_optional_key_runs_normally_without_one(self):
        request = APIRequestFactory().post("/x/", {"value": 1}, format="json")
        force_authenticate(request, user=make_user())
        response = OptionalKeyView.as_view()(request)
        self.assertEqual((response.status_code, response.data), (201, {"echo": 1}))
        self.assertEqual(IdempotencyRecord.objects.count(), 0)

    def test_action_names_are_validated(self):
        for action in ["", "x" * 101]:
            with self.subTest(action=action), self.assertRaises(ValueError):
                idempotent(action)


class PurgeTests(TestCase):
    def test_purge_removes_only_expired_records(self):
        user = make_user()
        now = timezone.now()
        for key, expires in [("old-1", -10), ("old-2", -1), ("fresh", 60)]:
            IdempotencyRecord.objects.create(
                user=user,
                action="a",
                key=key,
                request_fingerprint="f",
                response_status=201,
                expires_at=now + timedelta(minutes=expires),
            )
        out = StringIO()
        call_command("purge_idempotency_records", batch_size=1, stdout=out)
        self.assertIn("Removed 2", out.getvalue())
        self.assertEqual(list(IdempotencyRecord.objects.values_list("key", flat=True)), ["fresh"])
        self.assertEqual(purge_expired(), 0)

    def test_batch_size_must_be_positive(self):
        with self.assertRaises(CommandError):
            call_command("purge_idempotency_records", batch_size=0)


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class ConcurrentDuplicateTests(TransactionTestCase):
    """Ten simultaneous submissions with one key on real PostgreSQL create exactly one record."""

    PARALLEL = 10

    def test_simultaneous_duplicates_create_exactly_one_record(self):
        user = make_user()
        clients = [signed_in_client(user) for _ in range(self.PARALLEL)]
        barrier = threading.Barrier(self.PARALLEL)
        results: list[tuple[int, dict]] = []
        lock = threading.Lock()

        def submit(client: APIClient) -> None:
            try:
                barrier.wait(timeout=10)
                response = client.post(ITEMS, item_payload(), format="json", HTTP_IDEMPOTENCY_KEY="double-click")
                with lock:
                    results.append((response.status_code, response.json()))
            finally:
                connections.close_all()

        threads = [threading.Thread(target=submit, args=(client,)) for client in clients]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=60)

        self.assertEqual(len(results), self.PARALLEL)
        statuses = {status for status, _ in results}
        self.assertLessEqual(statuses, {201, 409}, results)
        self.assertIn(201, statuses)
        for status, body in results:
            if status == 409:
                self.assertEqual(body["error"]["code"], "request_in_progress")
        self.assertEqual(ReferenceItem.objects.count(), 1)
        self.assertEqual(IdempotencyRecord.objects.count(), 1)
        created_ids = {body["id"] for status, body in results if status == 201}
        self.assertEqual(len(created_ids), 1)

        retry = clients[0].post(ITEMS, item_payload(), format="json", HTTP_IDEMPOTENCY_KEY="double-click")
        self.assertEqual(retry.status_code, 201)
        self.assertEqual({retry.json()["id"]}, created_ids)
