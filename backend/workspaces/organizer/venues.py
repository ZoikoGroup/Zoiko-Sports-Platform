"""Screen endpoint of the Organizer's Venues & Readiness page: GET /api/v1/organizer/venues/.

One permission-scoped read fills the whole page (summary, readiness queue, needs
attention, today's activity, regional snapshot), so its totals and lists always
agree. Everything comes from readiness.selectors.board; this file only shapes it.
"""

from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_core.authorization import RequirePermission
from platform_core.openapi import error_responses
from platform_core.workspace import HasWorkspaceContext, require_workspace_context
from readiness import selectors as readiness

VIEW_PERMISSION = "readiness.view"


class SummarySerializer(serializers.Serializer):
    total = serializers.IntegerField(help_text="Venue readiness records in the queue (one per venue and event).")
    ready = serializers.IntegerField()
    pending_review = serializers.IntegerField()
    needs_attention = serializers.IntegerField()


class CheckCountSerializer(serializers.Serializer):
    complete = serializers.IntegerField()
    total = serializers.IntegerField()


class CheckSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    state = serializers.ChoiceField(choices=["complete", "pending", "attention"])
    # A field named "label" shadows Field.label for the type checker only; DRF treats it as a field.
    label = serializers.CharField(help_text="Accepted, Submitted, Open, Changes requested or Overdue.")  # type: ignore[assignment]


class VenueSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="The readiness record (one venue for one event).")
    venue_id = serializers.UUIDField()
    venue = serializers.CharField()
    event_id = serializers.UUIDField()
    event = serializers.CharField()
    competition_id = serializers.UUIDField()
    competition = serializers.CharField()
    city = serializers.CharField()
    country = serializers.CharField(help_text="ISO 3166-1 alpha-2.")
    region = serializers.CharField()
    time_zone = serializers.CharField(help_text="The event's IANA time zone.")
    starts_at = serializers.DateTimeField()
    status = serializers.ChoiceField(choices=list(readiness.STATUSES))
    evidence_items = serializers.IntegerField(help_text="Evidence the venue submitted for its shared checks.")
    checks = CheckCountSerializer(allow_null=True, help_text="Null when the venue shares no checks.")
    issue = serializers.CharField(allow_null=True, help_text="Why it needs attention.")
    check_list = CheckSerializer(many=True, help_text="Shared checks only, in checklist order.")


class AttentionSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="The check that needs attention.")
    readiness_id = serializers.UUIDField()
    venue = serializers.CharField()
    detail = serializers.CharField()
    severity = serializers.ChoiceField(choices=["high", "medium"])


class ActivitySerializer(serializers.Serializer):
    id = serializers.CharField()
    readiness_id = serializers.UUIDField()
    venue = serializers.CharField()
    summary = serializers.CharField()
    kind = serializers.ChoiceField(choices=["completed", "in_progress", "scheduled"])
    at = serializers.DateTimeField()
    time_zone = serializers.CharField()


class RegionSerializer(serializers.Serializer):
    region = serializers.CharField()
    ready = serializers.IntegerField()
    total = serializers.IntegerField()


class VenuesScreenSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    summary = SummarySerializer()
    venues = VenueSerializer(many=True)
    attention = AttentionSerializer(many=True)
    activity = ActivitySerializer(many=True, help_text="Today, in each event's time zone; newest first.")
    regions = RegionSerializer(many=True)


def _venue(row: readiness.ReadinessRow) -> dict[str, Any]:
    record = row.record
    event = record.event
    competition = event.competition
    return {
        "id": record.public_id,
        "venue_id": record.venue.public_id,
        "venue": record.venue.name,
        "event_id": event.public_id,
        "event": event.name,
        "competition_id": competition.public_id,
        "competition": competition.name,
        "city": event.city,
        "country": event.country,
        "region": event.region,
        "time_zone": event.time_zone,
        "starts_at": event.starts_at,
        "status": row.status,
        "evidence_items": row.evidence_items,
        "checks": {"complete": row.complete, "total": len(row.checks)} if row.checks else None,
        "issue": row.issue,
        "check_list": [{"id": c.id, "title": c.title, "state": c.state, "label": c.label} for c in row.checks],
    }


def screen(board: readiness.Board) -> dict[str, Any]:
    return {
        "generated_at": board.generated_at,
        "summary": {
            "total": len(board.rows),
            "ready": board.count(readiness.READY),
            "pending_review": board.count(readiness.PENDING_REVIEW),
            "needs_attention": board.count(readiness.NEEDS_ATTENTION),
        },
        "venues": [_venue(row) for row in board.rows],
        "attention": [vars(item) for item in board.attention],
        "activity": [vars(item) for item in board.activity],
        "regions": [vars(item) for item in board.regions],
    }


class VenuesScreenView(APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceContext, RequirePermission(VIEW_PERMISSION)]

    @extend_schema(
        tags=["organizer"],
        summary="Venues & Readiness page",
        description=(
            "Readiness of the venues hosting the acting organizer's events: summary, queue, items needing "
            "attention, today's activity and totals by region, from one scoped read. Only checks the venue "
            "shared are included. Needs an organization workspace whose role grants `readiness.view`."
        ),
        responses={200: VenuesScreenSerializer, **error_responses(401, 403)},
    )
    def get(self, request: Request) -> Response:
        context = require_workspace_context(request)
        return Response(VenuesScreenSerializer(screen(readiness.board(context))).data)
