"""Invitation email.

The link carries the token in the URL fragment (#token=...). Browsers never
send the fragment to a server, so the token stays out of nginx and proxy access
logs; the frontend reads it and posts it to the API.
"""

from datetime import UTC

from django.conf import settings
from django.core.mail import send_mail

from .models import Invitation


def accept_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/invitations/accept#token={token}"


def _role_label(role: str) -> str:
    return role.replace("_", " ")


def send_invitation(invitation: Invitation, token: str) -> None:
    organization = invitation.organization
    expires_utc = invitation.expires_at.astimezone(UTC)
    expires = f"{expires_utc:%B} {expires_utc.day}, {expires_utc:%Y} at {expires_utc:%H:%M} UTC"
    body = (
        f"Hello,\n\n"
        f"You've been invited to join {organization.name} on Zoiko Sports as {_role_label(invitation.role)}.\n\n"
        f"Open the link below, then sign in (or create an account) with this email address to accept:\n\n"
        f"{accept_link(token)}\n\n"
        f"The link can be used once and expires on {expires}.\n"
        "If you weren't expecting this invitation, you can ignore this email."
    )
    send_mail(
        f"You're invited to join {organization.name} on Zoiko Sports",
        body,
        settings.DEFAULT_FROM_EMAIL,
        [invitation.email],
        fail_silently=False,
    )
