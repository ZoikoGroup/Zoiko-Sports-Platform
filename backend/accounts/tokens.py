from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .models import User


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Single-use: the token stops validating once the account is activated."""

    key_salt = "accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.is_active}{user.password}{timestamp}"


password_reset_token = PasswordResetTokenGenerator()
email_verification_token = EmailVerificationTokenGenerator()


def encode_uid(user: User) -> str:
    return urlsafe_base64_encode(force_bytes(user.pk))


def user_from_uid(uid: str) -> User | None:
    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
