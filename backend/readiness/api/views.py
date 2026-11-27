"""HTTP endpoints of the readiness module (resource endpoints; the page's read is in workspaces)."""

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from access.selectors import can
from platform_core.authorization import RequirePermission, deny
from platform_core.idempotency import idempotent
from platform_core.openapi import IDEMPOTENCY_KEY_PARAMETER, error_responses
from platform_core.workspace import HasWorkspaceContext, require_workspace_context

from .. import policies, selectors, services
from .serializers import UpdateRequestInputSerializer, UpdateRequestSerializer


class UpdateRequestCreateView(APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceContext, RequirePermission(policies.REQUEST_UPDATE)]

    @extend_schema(
        tags=["readiness"],
        summary="Ask a venue to update its readiness",
        description=(
            "The event's organizer asks the venue to update its readiness for that event. The venue sees "
            "it in its activity feed. Needs an organization workspace whose role grants "
            "`readiness.request_update`; readiness of another organizer's event answers 404."
        ),
        request=UpdateRequestInputSerializer,
        parameters=[IDEMPOTENCY_KEY_PARAMETER],
        responses={201: UpdateRequestSerializer, **error_responses(400, 401, 403, 404, 409, 422)},
    )
    @idempotent("readiness.request_update")
    def post(self, request: Request, readiness_id: UUID) -> Response:
        context = require_workspace_context(request)
        readiness = selectors.readiness_record(context, readiness_id)
        if readiness is None:
            deny(visible=False)
        if not can(context, policies.REQUEST_UPDATE, readiness):
            deny(visible=True)
        serializer = UpdateRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update = services.request_update(
            readiness, message=serializer.validated_data["message"], actor=request.user, context=context
        )
        return Response(UpdateRequestSerializer(update).data, status=status.HTTP_201_CREATED)
