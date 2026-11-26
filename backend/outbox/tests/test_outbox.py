"""P4.1 to P4.3 and P4.5: publishing, the worker (retries, dead letters, exactly once), operations tooling."""

import tempfile
import threading
import time
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.db import connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from audit.models import AuditEntry
from audit.services import record
from outbox import selectors, services, worker
from outbox.models import Delivery, OutboxEvent
from platform_core.events import EventContractError, EventType
from platform_core.request_context import get_request_id, request_context

THING = EventType("test_thing.happened", 1, fields=("n",), optional=("note",), description="Test-only event.")
OTHER = EventType("test_other.happened", 1, fields=("n",), description="Test-only event nobody consumes.")


class Recorder:
    """A test consumer: remembers what it saw, and can be told to fail."""

    def __init__(self) -> None:
        self.seen: list[services.DeliveredEvent] = []
        self.request_ids: list[str | None] = []
        self.fail_with: BaseException | None = None

    def __call__(self, event: services.DeliveredEvent) -> None:
        record("test.effect", context=None, details={"n": event.payload["n"]})
        if self.fail_with is not None:
            raise self.fail_with
        self.seen.append(event)
        self.request_ids.append(get_request_id())


def subscribe(test, name: str = "tests.recorder") -> Recorder:
    recorder = Recorder()
    services.subscribe(name, [THING], recorder)
    test.addCleanup(services.unsubscribe, name)
    return recorder


def publish(n: int, **extra) -> OutboxEvent:
    return services.publish(THING, {"n": n, **extra}, aggregate=("thing", n))


def effects() -> int:
    return AuditEntry.objects.filter(action="test.effect").count()


class PublishTests(TestCase):
    def test_payload_must_match_the_contract(self):
        with self.assertRaisesMessage(EventContractError, "missing ['n']"):
            services.publish(THING, {}, aggregate=("thing", 1))
        with self.assertRaisesMessage(EventContractError, "undeclared ['secret']"):
            services.publish(THING, {"n": 1, "secret": "x"}, aggregate=("thing", 1))
        with self.assertRaisesMessage(EventContractError, "not JSON"):
            services.publish(THING, {"n": object()}, aggregate=("thing", 1))
        self.assertFalse(OutboxEvent.objects.exists())

    def test_event_types_are_validated_and_registered_once(self):
        with self.assertRaises(EventContractError):
            EventType("NoDots", 1, fields=(), description="")
        with self.assertRaises(EventContractError):
            EventType("x.happened", 0, fields=(), description="")
        with self.assertRaises(EventContractError):
            EventType("x.happened", 1, fields=("a", "a"), description="")
        with self.assertRaises(EventContractError):
            EventType("test_thing.happened", 1, fields=("different",), description="Conflicting declaration.")
        self.assertEqual(THING.module, "outbox")  # declared in outbox's tests
        self.assertEqual(THING.key, "test_thing.happened.v1")

    def test_one_delivery_per_subscribed_consumer(self):
        subscribe(self, "tests.one")
        subscribe(self, "tests.two")
        with request_context("req-7"):
            event = publish(1, note="hello")
        self.assertEqual(sorted(event.deliveries.values_list("consumer", flat=True)), ["tests.one", "tests.two"])
        self.assertEqual(
            (event.type, event.version, event.aggregate_id, event.request_id), (THING.name, 1, "1", "req-7")
        )
        nobody = services.publish(OTHER, {"n": 2}, aggregate=("other", 2))
        self.assertFalse(nobody.deliveries.exists())

    def test_rolled_back_change_leaves_no_event(self):
        subscribe(self)
        with self.assertRaises(RuntimeError), transaction.atomic():
            publish(1)
            raise RuntimeError("the change failed")
        self.assertFalse(OutboxEvent.objects.exists())
        self.assertFalse(Delivery.objects.exists())

    def test_subscribe_rules(self):
        with self.assertRaises(ValueError):
            services.subscribe("nodot", [THING], Recorder())
        subscribe(self, "tests.same")
        with self.assertRaises(ValueError):
            services.subscribe("tests.same", [THING], Recorder())


@override_settings(OUTBOX_MAX_ATTEMPTS=3, OUTBOX_RETRY_BASE_SECONDS=2, OUTBOX_RETRY_MAX_SECONDS=5)
class WorkerTests(TestCase):
    def test_delivers_once_with_the_events_correlation_id(self):
        recorder = subscribe(self)
        with request_context("req-9"):
            publish(1)
        self.assertEqual(worker.deliver_due(), 1)
        self.assertEqual(worker.deliver_due(), 0)
        delivery = Delivery.objects.get()
        self.assertEqual((delivery.status, delivery.attempts, delivery.last_error), ("done", 1, ""))
        self.assertEqual([e.payload["n"] for e in recorder.seen], [1])
        self.assertEqual(recorder.request_ids, ["req-9"])

    def test_failure_rolls_back_the_consumer_retries_with_backoff_then_dies(self):
        recorder = subscribe(self)
        recorder.fail_with = RuntimeError("provider down")
        publish(1)
        with self.assertLogs("outbox.worker", "WARNING"):
            worker.deliver_due()
        delivery = Delivery.objects.get()
        self.assertEqual((delivery.status, delivery.attempts), ("pending", 1))
        self.assertIn("RuntimeError: provider down", delivery.last_error)
        self.assertGreater(delivery.available_at, timezone.now() + timedelta(seconds=1))
        self.assertEqual(effects(), 0)  # the consumer's own writes were rolled back
        self.assertEqual(worker.deliver_due(), 0)  # not due yet

        for expected_status in ("pending", "dead"):
            Delivery.objects.update(available_at=timezone.now())
            with self.assertLogs("outbox.worker"):
                worker.deliver_due()
            self.assertEqual(Delivery.objects.get().status, expected_status)
        self.assertEqual(Delivery.objects.get().attempts, 3)
        self.assertEqual(worker.retry_delay(1), timedelta(seconds=2))
        self.assertEqual(worker.retry_delay(10), timedelta(seconds=5))

    def test_consumer_missing_in_this_process_is_recorded(self):
        subscribe(self, "tests.gone")
        publish(1)
        services.unsubscribe("tests.gone")
        with self.assertLogs("outbox.worker", "WARNING"):
            worker.deliver_due()
        self.assertIn("No consumer named 'tests.gone'", Delivery.objects.get().last_error)

    def test_replay_backfill_and_purge(self):
        recorder = subscribe(self)
        recorder.fail_with = RuntimeError("boom")
        publish(1)
        Delivery.objects.update(status="dead", attempts=3)
        recorder.fail_with = None
        self.assertEqual(services.replay(), 1)
        self.assertEqual(AuditEntry.objects.filter(action="outbox.replayed").count(), 1)
        worker.deliver_due()
        self.assertEqual(Delivery.objects.get().status, "done")
        self.assertEqual(services.replay(), 0)
        self.assertEqual(services.replay(include_done=True, consumer="tests.recorder"), 1)
        worker.deliver_due()
        self.assertEqual(len(recorder.seen), 2)  # a replay re-delivers: consumers must be idempotent

        # A consumer added later can receive past events.
        late = Recorder()
        services.subscribe("tests.late", [THING], late)
        self.addCleanup(services.unsubscribe, "tests.late")
        self.assertEqual(services.backfill("tests.late"), 1)
        self.assertEqual(services.backfill("tests.late"), 0)
        self.assertEqual(services.backfill("tests.late", since=timezone.now() + timedelta(days=1)), 0)
        worker.deliver_due()
        self.assertEqual(len(late.seen), 1)
        with self.assertRaises(ValueError):
            services.backfill("tests.unknown")

        # Purge removes only fully delivered events older than the cutoff.
        publish(2)  # pending: kept
        OutboxEvent.objects.update(occurred_at=timezone.now() - timedelta(days=40))
        self.assertEqual(services.purge(older_than=timezone.now() - timedelta(days=30)), 1)
        self.assertEqual(OutboxEvent.objects.count(), 1)

    def test_stats(self):
        subscribe(self)
        publish(1)
        publish(2)
        worker.deliver_next()
        stats = selectors.stats()
        self.assertEqual((stats.pending, stats.due, stats.done, stats.dead), (1, 1, 1, 0))
        self.assertIsNotNone(stats.oldest_pending_seconds)
        self.assertIsNotNone(stats.lag_p95_ms)
        Delivery.objects.filter(status="pending").update(status="dead")
        self.assertEqual(selectors.stats().dead_by_consumer, {"tests.recorder": 1})

    def test_worker_loop_beats_and_stops(self):
        recorder = subscribe(self)
        publish(1)
        with tempfile.TemporaryDirectory() as folder:
            heartbeat = Path(folder) / "beat"
            loop = worker.Worker(poll_interval=0.01, batch_size=10, heartbeat=heartbeat)
            loop.run(max_loops=2)
            self.assertTrue(heartbeat.exists())
        self.assertEqual(len(recorder.seen), 1)
        loop.stop()
        self.assertTrue(loop.stopping.is_set())
        loop.run()  # already stopped: returns at once

    def test_operator_command(self):
        subscribe(self)
        publish(1)
        out = StringIO()
        call_command("outbox", "status", stdout=out)
        self.assertIn("pending 1 (due now 1)", out.getvalue())
        self.assertIn("consumers:", out.getvalue())
        out = StringIO()
        call_command("outbox", "worker", "--once", stdout=out)
        self.assertIn("Delivered 1", out.getvalue())
        Delivery.objects.update(status="dead")
        out = StringIO()
        call_command("outbox", "status", stdout=out)
        self.assertIn("dead for tests.recorder: 1", out.getvalue())
        out = StringIO()
        call_command("outbox", "replay", "--consumer", "tests.recorder", stdout=out)
        self.assertIn("Requeued 1", out.getvalue())
        out = StringIO()
        call_command("outbox", "backfill", "tests.recorder", "--since", "2026-01-01", stdout=out)
        self.assertIn("Queued 0", out.getvalue())
        with self.assertRaisesMessage(CommandError, "No consumer"):
            call_command("outbox", "backfill", "tests.nobody")
        out = StringIO()
        call_command("outbox", "purge", "--older-than-days", "30", stdout=out)
        self.assertIn("Deleted 0", out.getvalue())
        with self.assertRaises(CommandError):
            call_command("outbox", "purge", "--older-than-days", "0")


class ExactlyOnceTests(TransactionTestCase):
    """Exit criteria: after an injected crash each event takes effect exactly once; parallel workers never double up."""

    serialized_rollback = True

    def test_a_worker_killed_mid_delivery_leaves_it_for_the_next_one(self):
        recorder = subscribe(self)
        publish(1)
        recorder.fail_with = KeyboardInterrupt()  # the process dies, not a handled error
        with self.assertRaises(KeyboardInterrupt):
            worker.deliver_due()
        delivery = Delivery.objects.get()
        self.assertEqual((delivery.status, delivery.attempts), ("pending", 0))  # rolled back with the crash
        self.assertEqual(effects(), 0)
        recorder.fail_with = None
        worker.deliver_due()
        self.assertEqual(effects(), 1)
        self.assertEqual(Delivery.objects.get().status, "done")

    def test_parallel_workers_process_each_delivery_once(self):
        recorder = subscribe(self)
        for n in range(40):
            publish(n)

        def run():
            try:
                worker.deliver_due()
            finally:
                connection.close()

        threads = [threading.Thread(target=run) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)
        self.assertEqual(sorted(e.payload["n"] for e in recorder.seen), list(range(40)))
        self.assertEqual(effects(), 40)
        self.assertEqual(Delivery.objects.filter(status="done").count(), 40)

    def test_delivery_lag_p95_is_under_two_seconds(self):
        recorder = subscribe(self)
        loop = worker.Worker(poll_interval=0.2, batch_size=50)

        def run():
            try:
                loop.run()
            finally:
                connection.close()

        thread = threading.Thread(target=run)
        thread.start()
        try:
            for n in range(60):
                publish(n)
                time.sleep(0.02)
            deadline = time.monotonic() + 15
            while len(recorder.seen) < 60 and time.monotonic() < deadline:
                time.sleep(0.05)
        finally:
            loop.stop()
            thread.join(10)
        self.assertEqual(len(recorder.seen), 60)
        stats = selectors.stats()
        self.assertIsNotNone(stats.lag_p95_ms)
        self.assertLess(stats.lag_p95_ms or 0, 2000, stats)
