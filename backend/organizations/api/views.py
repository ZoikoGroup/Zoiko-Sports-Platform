"""HTTP endpoints of the organizations module: invitation preview and acceptance.

Issuing invitations is a Zoiko operation for now (`manage.py organizations
invite`). A self-service endpoint for organization access managers needs the
permission engine (P3) and the Team & Access module.
"""

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.selectors import SessionSerializer, session_payload
from accounts.services import activate_context
from platform_core.errors import ApiError
from platform_core.openapi import error_responses

from .. import selectors, services
from ..models import Invitation, Organization
from .serializers import InvitationPreviewSerializer, InvitationTokenSerializer, mask_email

TAGS = ["invitations"]


@method_decorator(csrf_protect, name="dispatch")
class InvitationView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invitation"

    def token(self, request: Request) -> str:
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data["token"]


class InvitationPreviewView(InvitationView):
    """What an emailed invitation offers, so the person can decide before signing in.

    POST (not GET) keeps the token out of URLs and access logs.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=TAGS,
        summary="Preview an invitation",
        request=InvitationTokenSerializer,
        responses={200: InvitationPreviewSerializer, **error_responses(400, 403, 429)},
    )
    def post(self, request: Request) -> Response:
        invitation = selectors.invitation_for_token(self.token(request))
        if (
            invitation is None
            or invitation.status == Invitation.Status.REVOKED
            or invitation.organization.status != Organization.Status.ACTIVE
        ):
            raise ApiError("invitation_invalid", services.INVALID_INVITATION)
        organization = invitation.organization
        return Response(
            {
                "organization": {"name": organization.name, "kind": organization.kind},
                "account_type": selectors.KIND_TO_ACCOUNT_TYPE[Organization.Kind(organization.kind)],
                "role": invitation.role,
                "email": mask_email(invitation.email),
                "expires_at": invitation.expires_at,
                "state": services.invitation_state(invitation),
            }
        )


class InvitationAcceptView(InvitationView):
    """Join the organization and enter its workspace (the invitation's address must be the user's)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=TAGS,
        summary="Accept an invitation",
        description=(
            "Creates (or reactivates) the membership, marks the invitation used and makes the organization's "
            "workspace the active context. Errors: invitation_invalid, invitation_expired, invitation_used (409), "
            "invitation_email_mismatch (403), already_member (409)."
        ),
        request=InvitationTokenSerializer,
        responses={200: SessionSerializer, **error_responses(400, 401, 403, 409, 429)},
    )
    def post(self, request: Request) -> Response:
        membership = services.accept_invitation(token=self.token(request), user=request.user)
        context = selectors.find_context(request.user, str(membership.organization.public_id))
        if context is not None:
            activate_context(request, context)
        return Response(session_payload(request))
