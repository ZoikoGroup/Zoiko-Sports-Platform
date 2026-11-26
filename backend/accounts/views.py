"""Authentication and workspace-context endpoints.

Sign-in authenticates the person; it does not choose what they may act for.
The server resolves the account's workspace contexts from verified memberships
(organizations.selectors): one context is entered straight away, several are
offered for choosing, none leads to a no-access state. The sign-in tile is a
preference among those contexts and never a grant.

Every response that could reveal whether an email address is registered is
identical for known and unknown addresses (registration, password reset and
verification resend). Unsafe endpoints are CSRF-protected even for anonymous
callers, because DRF only enforces CSRF for already-authenticated sessions.
"""

import logging

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, password_validation
from django.core.exceptions import ValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from audit.services import record
from organizations.selectors import eligible_contexts, find_context
from platform_core.authorization import Public
from platform_core.errors import ApiError
from platform_core.openapi import error_responses
from platform_core.workspace import HasWorkspaceContext, require_workspace_context

from . import emails
from .models import AccountType, User
from .selectors import context_data, session_payload
from .serializers import (
    AuthConfigSerializer,
    ContextListSerializer,
    ContextSwitchSerializer,
    EmailSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    SessionSerializer,
    StatusSerializer,
    TokenSerializer,
    WorkspaceContextSerializer,
)
from .services import activate_context
from .tokens import email_verification_token, password_reset_token, user_from_uid

logger = logging.getLogger(__name__)

ACCEPTED = {"status": "accepted"}
TAGS = ["auth"]
ME_TAGS = ["me"]
# Anonymous, CSRF-protected and rate-limited endpoints share these error responses.
PUBLIC_WRITE_ERRORS = error_responses(400, 403, 429)
ACCEPTED_RESPONSE = OpenApiResponse(
    StatusSerializer, description="Accepted. Identical for registered and unknown addresses."
)


class PublicView(APIView):
    permission_classes = [Public]


@method_decorator(csrf_protect, name="dispatch")
class ThrottledPublicView(PublicView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicView):
    """Sets the CSRF cookie the SPA echoes back in X-CSRFToken."""

    @extend_schema(tags=TAGS, summary="Set the CSRF cookie", responses={200: StatusSerializer})
    def get(self, request):
        return Response({"status": "ok"})


class AuthConfigView(PublicView):
    """Which sign-in methods are genuinely available in this environment."""

    @extend_schema(tags=TAGS, summary="Available sign-in methods", responses={200: AuthConfigSerializer})
    def get(self, request):
        return Response(
            {
                "account_types": [{"id": value, "label": label} for value, label in AccountType.choices],
                "providers": [
                    {"id": key, "name": provider["name"], "enabled": provider["enabled"]}
                    for key, provider in settings.AUTH_PROVIDERS.items()
                ],
                "passkeys_enabled": settings.AUTH_PASSKEYS_ENABLED,
                "session_remember_days": settings.SESSION_COOKIE_AGE // 86400,
            }
        )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(PublicView):
    @extend_schema(tags=TAGS, summary="Current session", responses={200: SessionSerializer})
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False})
        return Response(session_payload(request))


class LoginView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Sign in",
        description=(
            "Authenticates, then resolves the account's workspace contexts: exactly one candidate is entered; "
            "several leave `context` null with `context_status` selection_required (choose one with "
            "PUT /me/context/); none gives no_access. `account_type` narrows the candidates when it matches "
            "and never grants access."
        ),
        request=LoginSerializer,
        responses={200: LoginResponseSerializer, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].strip().lower()

        user = authenticate(request, email=email, password=data["password"])
        if user is None:
            pending = User.objects.filter(email__iexact=email, is_active=False).first()
            if pending is not None and pending.check_password(data["password"]):
                raise ApiError(
                    "email_not_verified",
                    "Please verify your email address before signing in. We can send a new link.",
                    status.HTTP_403_FORBIDDEN,
                )
            logger.info("Sign-in failed (invalid credentials)")
            raise ApiError("invalid_credentials", "Incorrect email or password.", status.HTTP_400_BAD_REQUEST)

        login(request, user)
        # "Keep me signed in" keeps the session for SESSION_COOKIE_AGE; otherwise
        # it ends when the browser closes.
        request.session.set_expiry(settings.SESSION_COOKIE_AGE if data["remember"] else 0)

        contexts = eligible_contexts(user)
        preference = data.get("account_type")
        preferred = [c for c in contexts if c.account_type == preference] if preference else []
        candidates = preferred or contexts
        if len(candidates) == 1:
            # login() has just rotated the session ID.
            activate_context(request, candidates[0], rotate_session=False)
        active = request.workspace_context
        logger.info(
            "Sign-in succeeded user=%s workspace=%s contexts=%d",
            user.public_id,
            active.account_type if active else "none",
            len(contexts),
        )
        payload = session_payload(request)
        payload["preference_matched"] = bool(preferred) if preference else None
        return Response(payload)


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(PublicView):
    @extend_schema(
        tags=TAGS, summary="Sign out", request=None, responses={200: SessionSerializer, **error_responses(403)}
    )
    def post(self, request):
        logout(request)
        return Response({"authenticated": False})


class RegisterView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Register an account",
        request=RegisterSerializer,
        responses={202: ACCEPTED_RESPONSE, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].strip().lower()

        existing = User.objects.filter(email__iexact=email).first()
        if existing is None:
            user = User.objects.create_user(email, data["password"], full_name=data["full_name"], is_active=False)
            record("account.registered", actor=user, context=None)
            emails.send_verification(user)
        elif existing.is_active:
            emails.send_existing_account_notice(existing)
        else:
            emails.send_verification(existing)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class VerifyEmailView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Verify an email address",
        request=TokenSerializer,
        responses={200: StatusSerializer, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = user_from_uid(serializer.validated_data["uid"])
        if user is None or not email_verification_token.check_token(user, serializer.validated_data["token"]):
            raise ApiError("invalid_link", "This verification link is invalid or has already been used.")
        user.is_active = True
        user.save(update_fields=["is_active"])
        record("account.email_verified", actor=user, context=None)
        return Response({"status": "verified"})


class ResendVerificationView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Send a new verification link",
        request=EmailSerializer,
        responses={202: ACCEPTED_RESPONSE, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=False).first()
        if user is not None:
            emails.send_verification(user)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class PasswordResetView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Request a password-reset link",
        request=EmailSerializer,
        responses={202: ACCEPTED_RESPONSE, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user is not None and user.has_usable_password():
            emails.send_password_reset(user)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(ThrottledPublicView):
    @extend_schema(
        tags=TAGS,
        summary="Set a new password from a reset link",
        request=PasswordResetConfirmSerializer,
        responses={200: StatusSerializer, **PUBLIC_WRITE_ERRORS},
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = user_from_uid(data["uid"])
        if user is None or not password_reset_token.check_token(user, data["token"]):
            raise ApiError("invalid_link", "This reset link is invalid or has expired. Request a new one.")
        try:
            password_validation.validate_password(data["new_password"], user)
        except ValidationError as exc:
            raise ApiError(
                "validation_error", "Please choose a stronger password.", fields={"new_password": list(exc.messages)}
            ) from exc
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        record("account.password_changed", actor=user, context=None, details={"via": "reset_link"})
        return Response({"status": "password_changed"})


class ProviderStartView(ThrottledPublicView):
    """Entry point for federated sign-in. No provider flow is connected yet."""

    @extend_schema(
        tags=TAGS,
        summary="Start federated sign-in",
        description="No provider flow is connected yet: every call returns an error explaining why.",
        request=None,
        responses=error_responses(403, 404, 429, 501, 503),
    )
    def post(self, request, provider):
        config = settings.AUTH_PROVIDERS.get(provider)
        if config is None:
            raise ApiError("not_found", "Unknown sign-in method.", status.HTTP_404_NOT_FOUND)
        if not config["enabled"]:
            raise ApiError(
                "provider_unavailable",
                f"Sign-in with {config['name']} isn't available yet. Use your email and password.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        raise ApiError(
            "provider_not_connected",
            f"Sign-in with {config['name']} is configured but not yet connected.",
            status.HTTP_501_NOT_IMPLEMENTED,
        )


# --- The signed-in identity and its workspace context (/api/v1/me/) -------------


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=ME_TAGS,
        summary="The signed-in user and workspace contexts",
        responses={200: SessionSerializer, **error_responses(401)},
    )
    def get(self, request):
        return Response(session_payload(request))


class ContextListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=ME_TAGS,
        summary="Workspace contexts the user may act in",
        responses={200: ContextListSerializer, **error_responses(401)},
    )
    def get(self, request):
        active = request.workspace_context
        contexts = [context_data(c) for c in eligible_contexts(request.user)]
        return Response({"active": active.id if active else None, "contexts": contexts})


class ContextView(APIView):
    """The active workspace context: read it (requires one) or switch it."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), HasWorkspaceContext()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=ME_TAGS,
        summary="The active workspace context",
        responses={200: WorkspaceContextSerializer, **error_responses(401, 403)},
    )
    def get(self, request):
        return Response(context_data(require_workspace_context(request)))

    @extend_schema(
        tags=ME_TAGS,
        summary="Switch workspace context",
        description=(
            "Verifies the context against current memberships, rotates the session ID and drops every "
            "session value scoped to the previous context. 404 when the context is unknown or not the user's."
        ),
        request=ContextSwitchSerializer,
        responses={200: SessionSerializer, **error_responses(400, 401, 403, 404)},
    )
    def put(self, request):
        serializer = ContextSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        context = find_context(request.user, serializer.validated_data["context"])
        if context is None:
            raise ApiError(
                "context_not_found",
                "That workspace isn't available to your account.",
                status.HTTP_404_NOT_FOUND,
            )
        activate_context(request, context)
        return Response(session_payload(request))
