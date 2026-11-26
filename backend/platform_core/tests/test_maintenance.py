"""Scheduled housekeeping: expired sessions, idempotency records and old delivered events (D-046)."""

from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.sessions.models import Session
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from outbox.models import Delivery, OutboxEvent
from outbox.worker import Worker
from platform_core import maintenance
from platform_core.models import IdempotencyRecord


class HousekeepingTests(TestCase):
    def setUp(self):
        now = timezone.now()
        Session.objects.create(session_key="old", session_data="x", expire_date=now - timedelta(days=1))
        Session.objects.create(session_key="live", session_data="x", expire_date=now + timedelta(days=1))
        user = User.objects.create_user("maya@example.com", "x")
        for key, expires in (("k-old", now - timedelta(hours=1)), ("k-live", now + timedelta(hours=1))):
            IdempotencyRecord.objects.create(
                user=user,
                action="a",
                key=key,
                request_fingerprint="h",
                response_status=201,
                response_body={},
                expires_at=expires,
            )
        for days, status in ((40, "done"), (40, "dead"), (5, "done")):
            event = OutboxEvent.objects.create(
                type="thing.happened",
                version=1,
                aggregate_type="t",
                aggregate_id="1",
                payload={},
                occurred_at=now - timedelta(days=days),
            )
            Delivery.objects.create(
                event=event,
                consumer="tests.x",
                available_at=now,
                status=status,
                delivered_at=now if status == "done" else None,
            )

    def test_every_module_registers_its_task(self):
        self.assertEqual(
            maintenance.registered(),
            ["idempotency.purge_expired", "outbox.purge_delivered", "sessions.clear_expired"],
        )
        with self.assertRaises(ValueError):
            maintenance.register("nodot", lambda: 0)

    @override_settings(OUTBOX_RETENTION_DAYS=30)
    def test_removes_only_what_has_expired(self):
        with self.assertLogs("platform_core.maintenance", "INFO"):
            results = maintenance.run_all()
        self.assertEqual(
            results, {"idempotency.purge_expired": 1, "outbox.purge_delivered": 1, "sessions.clear_expired": 1}
        )
        self.assertEqual(list(Session.objects.values_list("session_key", flat=True)), ["live"])
        self.assertEqual(list(IdempotencyRecord.objects.values_list("key", flat=True)), ["k-live"])
        # Kept: the recent event and the old one with a dead (still replayable) delivery.
        self.assertEqual(OutboxEvent.objects.count(), 2)
        self.assertEqual(maintenance.run_all(), dict.fromkeys(results, 0))  # idempotent

    def test_one_failing_task_does_not_stop_the_others(self):
        def broken() -> int:
            raise RuntimeError("storage unavailable")

        maintenance.register("tests.broken", broken)
        self.addCleanup(maintenance._tasks.pop, "tests.broken")
        with self.assertLogs("platform_core.maintenance", "ERROR"):
            results = maintenance.run_all()
        self.assertIsNone(results["tests.broken"])
        self.assertEqual(results["sessions.clear_expired"], 1)
        with self.assertRaisesMessage(CommandError, "failed"), self.assertLogs("platform_core.maintenance"):
            call_command("maintenance", stdout=StringIO())

    def test_command(self):
        out = StringIO()
        call_command("maintenance", "--list", stdout=out)
        self.assertIn("outbox.purge_delivered", out.getvalue())
        out = StringIO()
        with self.assertLogs("platform_core.maintenance"):
            call_command("maintenance", stdout=out)
        self.assertIn("sessions.clear_expired: 1 removed", out.getvalue())

    def test_other_session_engines_use_their_own_cleanup(self):
        with (
            override_settings(SESSION_ENGINE="django.contrib.sessions.backends.signed_cookies"),
            patch("django.contrib.sessions.backends.signed_cookies.SessionStore.clear_expired") as clear,
        ):
            self.assertEqual(maintenance.clear_expired_sessions(), 0)
        clear.assert_called_once()


class WorkerScheduleTests(TestCase):
    def test_worker_runs_housekeeping_once_per_interval(self):
        with patch("outbox.worker.maintenance.run_all") as run_all:
            Worker(poll_interval=0.01, batch_size=1, maintenance_interval=3600).run(max_loops=3)
            self.assertEqual(run_all.call_count, 1)
            Worker(poll_interval=0.01, batch_size=1, maintenance_interval=0).run(max_loops=2)
            self.assertEqual(run_all.call_count, 1)  # 0 = schedule off
