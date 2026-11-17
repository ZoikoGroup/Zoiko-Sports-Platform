"""Authentication endpoints for the four sign-in workspaces.

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
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import emails
from .errors import ApiError
from .models import AccountType, Organization, User
from .serializers import (
    EmailSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    TokenSerializer,
    session_payload,
)
from .tokens import email_verification_token, password_reset_token, user_from_uid

logger = logging.getLogger(__name__)

ACCEPTED = {"status": "accepted"}


class PublicView(APIView):
    permission_classes = [AllowAny]


@method_decorator(csrf_protect, name="dispatch")
class ThrottledPublicView(PublicView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicView):
    """Sets the CSRF cookie the SPA echoes back in X-CSRFToken."""

    def get(self, request):
        return Response({"status": "ok"})


class AuthConfigView(PublicView):
    """Which sign-in methods are genuinely available in this environment."""

    def get(self, request):
        return Response(
            {
                "account_types": [{"id": value, "label": label} for value, label in AccountType.choices],
                "providers": [
                    {"id": key, "name": provider["name"], "enabled": provider["enabled"]}
                    for key, provider in settings.AUTH_PROVIDERS.items()
                ],
                "passkeys_enabled": settings.AUTH_PASSKEYS_ENABLED,
            }
        )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(PublicView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False})
        return Response({"authenticated": True, **session_payload(request)})


class LoginView(ThrottledPublicView):
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

        account_type = data["account_type"]
        available = user.available_account_types()
        if account_type not in available:
            label = AccountType(account_type).label
            raise ApiError(
                "workspace_unavailable",
                f"This account doesn't have access to a {label} workspace. Choose another account type.",
                status.HTTP_403_FORBIDDEN,
                fields={"available_account_types": available},
            )

        organization_id = None
        if account_type != AccountType.INDIVIDUAL:
            membership = (
                user.active_memberships()
                .filter(organization__kind=Organization.ACCOUNT_TYPE_TO_KIND[account_type])
                .order_by("created_at", "pk")
                .first()
            )
            organization_id = membership.organization_id

        login(request, user)
        request.session["account_type"] = account_type
        request.session["organization_id"] = organization_id
        # "Keep me signed in" keeps the session for SESSION_COOKIE_AGE; otherwise
        # it ends when the browser closes.
        request.session.set_expiry(settings.SESSION_COOKIE_AGE if data["remember"] else 0)
        logger.info("Sign-in succeeded user=%s workspace=%s", user.pk, account_type)
        return Response({"authenticated": True, **session_payload(request)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(PublicView):
    def post(self, request):
        logout(request)
        return Response({"authenticated": False})


class RegisterView(ThrottledPublicView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].strip().lower()

        existing = User.objects.filter(email__iexact=email).first()
        if existing is None:
            user = User.objects.create_user(email, data["password"], full_name=data["full_name"], is_active=False)
            emails.send_verification(user)
        elif existing.is_active:
            emails.send_existing_account_notice(existing)
        else:
            emails.send_verification(existing)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class VerifyEmailView(ThrottledPublicView):
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = user_from_uid(serializer.validated_data["uid"])
        if user is None or not email_verification_token.check_token(user, serializer.validated_data["token"]):
            raise ApiError("invalid_link", "This verification link is invalid or has already been used.")
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"status": "verified"})


class ResendVerificationView(ThrottledPublicView):
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=False).first()
        if user is not None:
            emails.send_verification(user)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class PasswordResetView(ThrottledPublicView):
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user is not None and user.has_usable_password():
            emails.send_password_reset(user)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(ThrottledPublicView):
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
            )
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Response({"status": "password_changed"})


class ProviderStartView(ThrottledPublicView):
    """Entry point for federated sign-in. No provider flow is connected yet."""

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
