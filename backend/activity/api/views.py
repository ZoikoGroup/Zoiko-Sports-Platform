"""HTTP endpoint of the activity module: the acting organization's activity feed."""

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_core.authorization import RequirePermission
from platform_core.openapi import error_responses
from platform_core.pagination import CursorPage
from platform_core.workspace import HasWorkspaceContext, require_workspace_context

from .. import selectors
from .serializers import ActivityEntrySerializer


class ActivityFeedView(APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceContext, RequirePermission("activity.view")]
    pagination_class = CursorPage

    @extend_schema(
        tags=["activity"],
        summary="The organization's activity feed",
        description=(
            "Readable entries about the acting organization, newest first, built from events. Needs an "
            "organization workspace whose role grants `activity.view`. Entries about other organizations "
            "are never included."
        ),
        responses={200: ActivityEntrySerializer(many=True), **error_responses(400, 401, 403)},
    )
    def get(self, request: Request) -> Response:
        context = require_workspace_context(request)
        paginator = self.pagination_class(ordering=("-occurred_at", "-id"))
        page = paginator.paginate_queryset(selectors.feed_for(context), request, view=self)
        return paginator.get_paginated_response(ActivityEntrySerializer(page, many=True).data)
