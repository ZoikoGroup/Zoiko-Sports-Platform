"""Reading venue readiness (the readiness module's public read interface).

Every read starts from access.selectors.scope_to_context: an organizer sees the
readiness of venues hosting its own events, and nothing else (P3.3). Only checks
the venue shared are ever read for the organizer: unshared checks don't count
towards totals, statuses or evidence, and are never listed.

Readiness status of one venue for one event (D-047), from its shared checks:
- needs_attention: a check has changes requested, or is open past its due time;
- ready: it has checks and every one is accepted;
- pending_review: anything else (planning, evidence submitted, in review).
Severity of an attention item: high for a critical check, else medium.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from django.db.models import Count, QuerySet
from django.utils import timezone

from access.selectors import scope_to_context
from platform_core.timeutils import to_local
from platform_core.workspace import WorkspaceContext

from .models import CheckState, ReadinessCheck, VenueReadiness

READY = "ready"
PENDING_REVIEW = "pending_review"
NEEDS_ATTENTION = "needs_attention"
STATUSES = (READY, PENDING_REVIEW, NEEDS_ATTENTION)
ACTIVITY_LIMIT = 8


@dataclass(frozen=True)
class CheckView:
    id: UUID
    title: str
    # complete (accepted), pending (open or submitted), attention (changes requested or overdue)
    state: str
    label: str
    critical: bool
    evidence: int
    detail: str = ""


@dataclass(frozen=True)
class ReadinessRow:
    record: VenueReadiness
    status: str
    checks: list[CheckView]
    evidence_items: int
    complete: int
    issue: str | None


@dataclass(frozen=True)
class AttentionItem:
    id: UUID
    readiness_id: UUID
    venue: str
    detail: str
    severity: str


@dataclass(frozen=True)
class ActivityItem:
    id: str
    readiness_id: UUID
    venue: str
    summary: str
    kind: str
    at: datetime
    time_zone: str


@dataclass(frozen=True)
class RegionTotal:
    region: str
    ready: int
    total: int


@dataclass
class Board:
    generated_at: datetime
    rows: list[ReadinessRow] = field(default_factory=list)
    attention: list[AttentionItem] = field(default_factory=list)
    activity: list[ActivityItem] = field(default_factory=list)
    regions: list[RegionTotal] = field(default_factory=list)

    def count(self, status: str) -> int:
        return sum(1 for row in self.rows if row.status == status)


def visible_readiness(context: WorkspaceContext | None) -> QuerySet[VenueReadiness]:
    """Readiness of venues hosting the context's own events (not cancelled), soonest event first."""
    queryset = (
        VenueReadiness.objects.select_related("event__competition__organization", "venue")
        .exclude(event__status="cancelled")
        .order_by("event__starts_at", "pk")
    )
    return scope_to_context(queryset, context, owner_field="event__competition__organization_id")


def readiness_record(context: WorkspaceContext | None, public_id: UUID) -> VenueReadiness | None:
    """One visible readiness record, or None (unknown and not visible look the same: 404)."""
    return visible_readiness(context).filter(public_id=public_id).first()


def check_titles(public_ids: list[str]) -> dict[str, str]:
    """Check titles by public UUID (as strings); unknown IDs are left out (consumers' lookups)."""
    valid = []
    for value in public_ids:
        try:
            valid.append(UUID(str(value)))
        except ValueError:
            continue
    rows = ReadinessCheck.objects.filter(public_id__in=valid).values_list("public_id", "title")
    return {str(public_id): title for public_id, title in rows}


def _is_overdue(check: ReadinessCheck, now: datetime) -> bool:
    return check.state == CheckState.OPEN and check.due_at is not None and check.due_at < now


def _view(check: ReadinessCheck, now: datetime) -> CheckView:
    evidence = getattr(check, "evidence_count", 0)
    if check.state == CheckState.ACCEPTED:
        return CheckView(check.public_id, check.title, "complete", "Accepted", check.critical, evidence)
    if check.state == CheckState.CHANGES_REQUESTED:
        detail = f"{check.title}: changes requested" + (f" ({check.note})" if check.note else "")
        return CheckView(
            check.public_id, check.title, "attention", "Changes requested", check.critical, evidence, detail
        )
    if _is_overdue(check, now):
        return CheckView(
            check.public_id, check.title, "attention", "Overdue", check.critical, evidence, f"{check.title} is overdue"
        )
    label = "Submitted" if check.state == CheckState.SUBMITTED else "Open"
    return CheckView(check.public_id, check.title, "pending", label, check.critical, evidence)


def _status(checks: list[CheckView]) -> str:
    if any(c.state == "attention" for c in checks):
        return NEEDS_ATTENTION
    if checks and all(c.state == "complete" for c in checks):
        return READY
    return PENDING_REVIEW


def _same_local_day(instant: datetime, now: datetime, time_zone: str) -> bool:
    return to_local(instant, time_zone).date() == to_local(now, time_zone).date()


def _activity(record: VenueReadiness, check: ReadinessCheck, now: datetime) -> list[ActivityItem]:
    """What happened to (or is due for) a shared check today, in the event's time zone."""
    zone = record.event.time_zone
    venue = record.venue.name
    items = []

    def item(kind: str, summary: str, at: datetime) -> ActivityItem:
        return ActivityItem(f"{check.public_id}:{kind}", record.public_id, venue, summary, kind, at, zone)

    reviewed, submitted, due = check.reviewed_at, check.submitted_at, check.due_at
    if reviewed is not None and _same_local_day(reviewed, now, zone):
        if check.state == CheckState.ACCEPTED:
            items.append(item("completed", f"Readiness check completed: {check.title}", reviewed))
        else:
            items.append(item("in_progress", f"Changes requested: {check.title}", reviewed))
    elif check.state == CheckState.SUBMITTED and submitted is not None and _same_local_day(submitted, now, zone):
        items.append(item("in_progress", f"Evidence submitted for review: {check.title}", submitted))
    if check.state != CheckState.ACCEPTED and due is not None and _same_local_day(due, now, zone):
        items.append(item("scheduled", f"Due today: {check.title}", due))
    return items


def board(context: WorkspaceContext | None, *, now: datetime | None = None) -> Board:
    """Everything the Venues & Readiness page shows, from one scoped read."""
    now = now or timezone.now()
    result = Board(generated_at=now)
    records = list(visible_readiness(context))
    if not records:
        return result

    checks_by_record: dict[int, list[ReadinessCheck]] = defaultdict(list)
    shared = (
        ReadinessCheck.objects.filter(readiness__in=records, shared=True)
        .annotate(evidence_count=Count("evidence"))
        .order_by("readiness_id", "position")
    )
    for shared_check in shared:
        checks_by_record[shared_check.readiness_id].append(shared_check)

    regions: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for record in records:
        checks = checks_by_record[record.pk]
        views = [_view(check, now) for check in checks]
        status = _status(views)
        # Critical problems first, then checklist order.
        problems = sorted((v for v in views if v.state == "attention"), key=lambda v: not v.critical)
        result.rows.append(
            ReadinessRow(
                record=record,
                status=status,
                checks=views,
                evidence_items=sum(v.evidence for v in views),
                complete=sum(1 for v in views if v.state == "complete"),
                issue=problems[0].detail if problems else None,
            )
        )
        for problem in problems:
            result.attention.append(
                AttentionItem(
                    problem.id,
                    record.public_id,
                    record.venue.name,
                    problem.detail,
                    "high" if problem.critical else "medium",
                )
            )
        for check in checks:
            result.activity.extend(_activity(record, check, now))
        totals = regions[record.event.region]
        totals[0] += status == READY
        totals[1] += 1

    result.attention.sort(key=lambda a: (a.severity != "high", a.venue))
    result.activity.sort(key=lambda a: a.at, reverse=True)
    result.activity = result.activity[:ACTIVITY_LIMIT]
    result.regions = [
        RegionTotal(region, ready, total)
        for region, (ready, total) in sorted(regions.items(), key=lambda item: (-item[1][1], item[0]))
    ]
    return result
