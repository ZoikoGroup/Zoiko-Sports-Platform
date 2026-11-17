from django.conf import settings
from django.core.mail import send_mail

from .tokens import email_verification_token, encode_uid, password_reset_token


def _send(to: str, subject: str, body: str) -> None:
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)


def send_password_reset(user) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?uid={encode_uid(user)}&token={password_reset_token.make_token(user)}"
    _send(
        user.email,
        "Reset your Zoiko Sports password",
        f"Hello {user.full_name or user.email},\n\n"
        f"Use the link below to choose a new password. It can be used once and expires in "
        f"{settings.PASSWORD_RESET_TIMEOUT // 3600} hours.\n\n{link}\n\n"
        "If you didn't ask for this, you can ignore this email.",
    )


def send_verification(user) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?uid={encode_uid(user)}&token={email_verification_token.make_token(user)}"
    _send(
        user.email,
        "Verify your Zoiko Sports account",
        f"Hello {user.full_name or user.email},\n\nConfirm your email address to activate your account:\n\n{link}\n",
    )


def send_existing_account_notice(user) -> None:
    _send(
        user.email,
        "You already have a Zoiko Sports account",
        "Someone tried to create a Zoiko Sports account with this email address. You already have one — "
        f"sign in at {settings.FRONTEND_URL}/login or reset your password from there.",
    )
