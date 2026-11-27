"""Reading the outbox's state (the outbox's public read interface): queue sizes and delivery lag."""

from dataclasses import dataclass
from datetime import timedelta

from django.db.models import Count, DurationField, ExpressionWrapper, F, Min
from django.utils import timezone

from .models import Delivery

LAG_WINDOW = timedelta(hours=1)
LAG_SAMPLE = 10_000


@dataclass(frozen=True)
class OutboxStats:
    pending: int
    due: int
    dead: int
    done: int
    oldest_pending_seconds: float | None
    # Event → delivered, over deliveries completed in the last hour (milliseconds).
    lag_p50_ms: int | None
    lag_p95_ms: int | None
    dead_by_consumer: dict[str, int]


def _percentile(values: list[float], fraction: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * len(ordered)) - 1))
    return int(ordered[index])


def stats() -> OutboxStats:
    now = timezone.now()
    counts = dict(Delivery.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
    pending = Delivery.objects.filter(status=Delivery.Status.PENDING)
    oldest = pending.aggregate(oldest=Min("event__occurred_at"))["oldest"]
    lags = list(
        Delivery.objects.filter(status=Delivery.Status.DONE, delivered_at__gte=now - LAG_WINDOW)
        .annotate(lag=ExpressionWrapper(F("delivered_at") - F("event__occurred_at"), output_field=DurationField()))
        .order_by("-delivered_at")
        .values_list("lag", flat=True)[:LAG_SAMPLE]
    )
    milliseconds = [lag.total_seconds() * 1000 for lag in lags if lag is not None]
    dead_by_consumer = dict(
        Delivery.objects.filter(status=Delivery.Status.DEAD)
        .values_list("consumer")
        .annotate(n=Count("id"))
        .values_list("consumer", "n")
    )
    return OutboxStats(
        pending=counts.get(Delivery.Status.PENDING, 0),
        due=pending.filter(available_at__lte=now).count(),
        dead=counts.get(Delivery.Status.DEAD, 0),
        done=counts.get(Delivery.Status.DONE, 0),
        oldest_pending_seconds=(now - oldest).total_seconds() if oldest else None,
        lag_p50_ms=_percentile(milliseconds, 0.50),
        lag_p95_ms=_percentile(milliseconds, 0.95),
        dead_by_consumer=dead_by_consumer,
    )
