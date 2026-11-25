"""Write operations of the organizations module (the public write interface).

- Organizations start PENDING and grant no workspace until verified (FSD D11:
  no default entitlement). Verification, suspension and reinstatement are
  Zoiko operations (`manage.py organizations ...`) until the Internal
  Administration product exists.
- Joining an organization happens only by accepting an invitation: single-use,
  expiring, sent to one email address and accepted only by the account with
  that address. A role picked at sign-up or a sign-in tile is never a grant.
- Each operation runs in one transaction; concurrent accepts of the same
  invitation are serialised by a row lock, so exactly one succeeds.
"""

import logging
import re
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from platform_core.errors import ApiError

from . import emails
from .models import Invitation, Membership, Organization
from .tokens import hash_token, new_token

logger = logging.getLogger(__name__)

# Roles are free-form identifiers until the role catalog (P3) defines them.
ROLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,59}$")
_CREATE_ATTEMPTS = 3

INVALID_INVITATION = "This invitation link isn't valid. Ask the organization to send you a new one."


def _validation_error(field: str, message: str) -> ApiError:
    return ApiError("validation_error", message, fields={field: [message]})


def normalize_role(role: str) -> str:
    value = (role or "").strip().lower()
    if not ROLE_PATTERN.match(value):
        raise _validation_error(
            "role",
            "Use 2-60 lowercase letters, digits or underscores, starting with a letter (for example venue_manager).",
        )
    return value


def normalize_email(email: str) -> str:
    value = (email or "").strip().lower()
    if "@" not in value or value.startswith("@") or value.endswith("@") or len(value) > 254:
        raise _validation_error("email", "Enter a valid email address.")
    return value


# --- Organizations ------------------------------------------------------------


def create_organization(*, name: str, kind: str, jurisdiction: str = "", verified: bool = False) -> Organization:
    name = (name or "").strip()
    if not name or len(name) > 200:
        raise _validation_error("name", "Enter a name of up to 200 characters.")
    if kind not in Organization.Kind.values:
        raise _validation_error("kind", f"Choose one of: {', '.join(Organization.Kind.values)}.")
    jurisdiction = (jurisdiction or "").strip().upper()
    if len(jurisdiction) > 8:
        raise _validation_error("jurisdiction", "Use an ISO 3166 code such as US-CA.")
    now = timezone.now()
    organization = Organization.objects.create(
        name=name,
        kind=kind,
        jurisdiction=jurisdiction,
        status=Organization.Status.ACTIVE if verified else Organization.Status.PENDING,
        verified_at=now if verified else None,
    )
    logger.info("Organization created organization=%s status=%s", organization.public_id, organization.status)
    return organization


def ensure_organization(*, name: str, kind: str, jurisdiction: str = "") -> Organization:
    """The verified organization with this name and kind, created if missing (demo data and fixtures)."""
    existing = Organization.objects.filter(name=name, kind=kind).order_by("pk").first()
    if existing is None:
        return create_organization(name=name, kind=kind, jurisdiction=jurisdiction, verified=True)
    if existing.status == Organization.Status.PENDING:
        return verify_organization(existing)
    return existing


def verify_organization(organization: Organization) -> Organization:
    """PENDING -> ACTIVE. Verifying an active organization changes nothing."""
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        if organization.status == Organization.Status.SUSPENDED:
            raise ApiError(
                "organization_suspended",
                "This organization is suspended; reinstate it instead.",
                status.HTTP_409_CONFLICT,
            )
        if organization.status == Organization.Status.PENDING:
            organization.status = Organization.Status.ACTIVE
            organization.verified_at = timezone.now()
            organization.save(update_fields=["status", "verified_at", "updated_at"])
            logger.info("Organization verified organization=%s", organization.public_id)
    return organization


def suspend_organization(organization: Organization) -> Organization:
    """Every member loses this workspace on their next request."""
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        if organization.status != Organization.Status.SUSPENDED:
            organization.status = Organization.Status.SUSPENDED
            organization.save(update_fields=["status", "updated_at"])
            logger.info("Organization suspended organization=%s", organization.public_id)
    return organization


def reinstate_organization(organization: Organization) -> Organization:
    """SUSPENDED -> ACTIVE, or back to PENDING if it was never verified."""
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        if organization.status == Organization.Status.SUSPENDED:
            organization.status = (
                Organization.Status.ACTIVE if organization.verified_at else Organization.Status.PENDING
            )
            organization.save(update_fields=["status", "updated_at"])
            logger.info(
                "Organization reinstated organization=%s status=%s", organization.public_id, organization.status
            )
    return organization


# --- Memberships --------------------------------------------------------------


def grant_membership(*, user: Any, organization: Organization, role: str) -> Membership:
    """Make `user` an active member with `role` (demo data, fixtures and invitation acceptance)."""
    role = normalize_role(role)
    with transaction.atomic():
        membership, _ = Membership.objects.select_for_update().update_or_create(
            user=user,
            organization=organization,
            defaults={"role": role, "status": Membership.Status.ACTIVE, "valid_from": None, "valid_to": None},
        )
    return membership


def set_membership_status(*, user: Any, organization: Organization, status_value: str) -> Membership | None:
    """Suspend, revoke or reactivate a membership; the member's very next request reflects it."""
    if status_value not in {Membership.Status.ACTIVE, Membership.Status.SUSPENDED, Membership.Status.REVOKED}:
        raise _validation_error("status", "Choose active, suspended or revoked.")
    with transaction.atomic():
        membership = Membership.objects.select_for_update().filter(user=user, organization=organization).first()
        if membership is None:
            return None
        if membership.status != status_value:
            membership.status = status_value
            membership.save(update_fields=["status", "updated_at"])
            logger.info(
                "Membership status changed membership=%s organization=%s status=%s",
                membership.public_id,
                organization.public_id,
                status_value,
            )
    return membership


# --- Invitations --------------------------------------------------------------


def create_invitation(
    *,
    organization: Organization,
    email: str,
    role: str,
    invited_by: Any = None,
    ttl: timedelta | None = None,
) -> tuple[Invitation, str]:
    """Invite `email` to `organization` as `role`; returns the invitation and its one-time token.

    The token is emailed once (after commit) and never stored. An earlier
    pending invitation for the same address is revoked, so only the newest link works.
    """
    email = normalize_email(email)
    role = normalize_role(role)
    if organization.status != Organization.Status.ACTIVE:
        raise ApiError(
            "organization_unavailable",
            "Only verified, active organizations can invite members.",
            status.HTTP_409_CONFLICT,
        )
    expires_at = timezone.now() + (ttl or settings.INVITATION_TTL)
    token = new_token()

    for attempt in range(1, _CREATE_ATTEMPTS + 1):
        try:
            with transaction.atomic():
                # Serialises invitations per organization: concurrent invites for one
                # address apply one after another, and the last one wins.
                Organization.objects.select_for_update().filter(pk=organization.pk).first()
                Invitation.objects.filter(
                    organization=organization, email=email, status=Invitation.Status.PENDING
                ).update(status=Invitation.Status.REVOKED, revoked_at=timezone.now())
                invitation = Invitation.objects.create(
                    organization=organization,
                    email=email,
                    role=role,
                    token_hash=hash_token(token),
                    expires_at=expires_at,
                    invited_by=invited_by,
                )
            break
        except IntegrityError:
            # A concurrent invitation for the same address committed first: replace it.
            if attempt == _CREATE_ATTEMPTS:
                raise ApiError(
                    "invitation_conflict",
                    "Another invitation for this address is being created. Try again.",
                    status.HTTP_409_CONFLICT,
                ) from None

    transaction.on_commit(lambda: emails.send_invitation(invitation, token))
    logger.info(
        "Invitation created invitation=%s organization=%s expires_at=%s",
        invitation.public_id,
        organization.public_id,
        invitation.expires_at.isoformat(),
    )
    return invitation, token


def revoke_invitation(invitation: Invitation) -> Invitation:
    with transaction.atomic():
        invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
        if invitation.status == Invitation.Status.PENDING:
            invitation.status = Invitation.Status.REVOKED
            invitation.revoked_at = timezone.now()
            invitation.save(update_fields=["status", "revoked_at", "updated_at"])
            logger.info("Invitation revoked invitation=%s", invitation.public_id)
    return invitation


def invitation_state(invitation: Invitation) -> str:
    """pending, expired, accepted or revoked (expiry is evaluated now, not stored)."""
    if invitation.status == Invitation.Status.PENDING and invitation.expires_at <= timezone.now():
        return "expired"
    return str(invitation.status)


def accept_invitation(*, token: str, user: Any) -> Membership:
    """Join the invitation's organization; exactly one of any concurrent accepts succeeds."""
    with transaction.atomic():
        invitation = (
            Invitation.objects.select_for_update(of=("self",))
            .select_related("organization")
            .filter(token_hash=hash_token(token or ""))
            .first()
        )
        if invitation is None or invitation.status == Invitation.Status.REVOKED:
            raise ApiError("invitation_invalid", INVALID_INVITATION)
        if invitation.status == Invitation.Status.ACCEPTED:
            raise ApiError("invitation_used", "This invitation has already been used.", status.HTTP_409_CONFLICT)
        if invitation_state(invitation) == "expired":
            raise ApiError(
                "invitation_expired", "This invitation has expired. Ask the organization to send you a new one."
            )
        organization = invitation.organization
        if organization.status != Organization.Status.ACTIVE:
            raise ApiError("invitation_invalid", INVALID_INVITATION)
        if user.email.lower() != invitation.email:
            raise ApiError(
                "invitation_email_mismatch",
                "This invitation was sent to a different email address. Sign in with that address to accept it.",
                status.HTTP_403_FORBIDDEN,
            )

        membership = Membership.objects.select_for_update().filter(user=user, organization=organization).first()
        now = timezone.now()
        if (
            membership is not None
            and membership.status == Membership.Status.ACTIVE
            and (membership.valid_to is None or membership.valid_to > now)
        ):
            raise ApiError(
                "already_member", f"You're already a member of {organization.name}.", status.HTTP_409_CONFLICT
            )
        if membership is None:
            membership = Membership.objects.create(user=user, organization=organization, role=invitation.role)
        else:
            # A removed or suspended member re-invited by the organization comes back with the new role.
            membership.role = invitation.role
            membership.status = Membership.Status.ACTIVE
            membership.valid_from = None
            membership.valid_to = None
            membership.save(update_fields=["role", "status", "valid_from", "valid_to", "updated_at"])

        invitation.status = Invitation.Status.ACCEPTED
        invitation.accepted_by = user
        invitation.accepted_at = now
        invitation.save(update_fields=["status", "accepted_by", "accepted_at", "updated_at"])

    logger.info(
        "Invitation accepted invitation=%s organization=%s membership=%s",
        invitation.public_id,
        organization.public_id,
        membership.public_id,
    )
    return membership
