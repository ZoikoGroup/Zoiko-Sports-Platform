"""Audit of sign-in, failed sign-in and sign-out (P3.7), from Django's authentication signals.

Signals cover every way in, the API and Django's admin alike. A failed sign-in
records the account it targeted when that account exists (its public UUID,
never the email address typed); unknown addresses leave the actor empty.
"""

from typing import Any

from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver

from audit.services import record

from .models import User


@receiver(user_logged_in, dispatch_uid="accounts.audit.sign_in")
def audit_sign_in(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    record("auth.sign_in", actor=user, context=None)


@receiver(user_login_failed, dispatch_uid="accounts.audit.sign_in_failed")
def audit_failed_sign_in(sender: Any, credentials: dict[str, Any], request: Any = None, **kwargs: Any) -> None:
    email = str(credentials.get("email") or credentials.get("username") or "").strip()
    target = User.objects.filter(email__iexact=email).values_list("public_id", flat=True).first() if email else None
    record("auth.sign_in_failed", outcome="failed", actor=target, context=None)


@receiver(user_logged_out, dispatch_uid="accounts.audit.sign_out")
def audit_sign_out(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    if user is not None and getattr(user, "is_authenticated", False):
        record("auth.sign_out", actor=user)
