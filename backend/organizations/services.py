"""Write operations of the organizations module (the public write interface).

- Organizations start PENDING and grant no workspace until verified (FSD D11:
  no default entitlement). Verification, suspension and reinstatement are
  Zoiko operations (`manage.py organizations ...`) until the Internal
  Administration product exists.
- Joining an organization happens only by accepting an invitation: single-use,
  expiring, sent to one email address and accepted only by the account with
  that address. A role picked at sign-up or a sign-in tile is never a grant.
- Roles come from the access catalogue, and only roles offered for the
  organization's kind can be given (P3).
- Each operation runs in one transaction that also writes its audit entry (P3)
  and its event (P4), so a change, its audit record and its event commit or roll
  back together. Refusals are audited too, outside the refused transaction.
- Concurrent accepts of the same invitation are serialised by a row lock, so
  exactly one succeeds.
"""

import logging
import re
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from access.selectors import assignable_role, assignable_roles
from audit.services import record
from outbox.services import publish
from platform_core.errors import ApiError

from . import emails, events
from .models import Invitation, Membership, Organization
from .tokens import hash_token, new_token

logger = logging.getLogger(__name__)

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


def role_for(organization: Organization, role: str) -> str:
    """The role code if the catalogue offers it for this organization's kind; else a validation error."""
    code = normalize_role(role)
    if assignable_role(code, organization.kind) is None:
        offered = ", ".join(r.code for r in assignable_roles(organization.kind)) or "none"
        raise _validation_error("role", f"Choose a role offered for a {organization.kind} organization: {offered}.")
    return code


def normalize_email(email: str) -> str:
    value = (email or "").strip().lower()
    if "@" not in value or value.startswith("@") or value.endswith("@") or len(value) > 254:
        raise _validation_error("email", "Enter a valid email address.")
    return value


def _actor_public_id(actor: Any) -> str | None:
    return str(actor.public_id) if getattr(actor, "is_authenticated", False) else None


# --- Organizations ------------------------------------------------------------


def create_organization(
    *, name: str, kind: str, jurisdiction: str = "", verified: bool = False, actor: Any = None
) -> Organization:
    name = (name or "").strip()
    if not name or len(name) > 200:
        raise _validation_error("name", "Enter a name of up to 200 characters.")
    if kind not in Organization.Kind.values:
        raise _validation_error("kind", f"Choose one of: {', '.join(Organization.Kind.values)}.")
    jurisdiction = (jurisdiction or "").strip().upper()
    if len(jurisdiction) > 8:
        raise _validation_error("jurisdiction", "Use an ISO 3166 code such as US-CA.")
    now = timezone.now()
    with transaction.atomic():
        organization = Organization.objects.create(
            name=name,
            kind=kind,
            jurisdiction=jurisdiction,
            status=Organization.Status.ACTIVE if verified else Organization.Status.PENDING,
            verified_at=now if verified else None,
        )
        record(
            "organization.created",
            actor=actor,
            target=("organization", organization.public_id),
            details={"kind": kind, "status": organization.status},
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


def _change_organization_status(organization: Organization, new_status: str, action: str, actor: Any) -> None:
    """Inside the caller's transaction: save, audit and publish an organization status change."""
    previous = organization.status
    organization.status = new_status
    fields = ["status", "updated_at"]
    if new_status == Organization.Status.ACTIVE and organization.verified_at is None:
        organization.verified_at = timezone.now()
        fields.append("verified_at")
    organization.save(update_fields=fields)
    record(
        action,
        actor=actor,
        target=("organization", organization.public_id),
        details={"status": new_status, "previous_status": previous},
    )
    publish(
        events.ORGANIZATION_STATUS_CHANGED,
        {"organization_id": str(organization.public_id), "status": new_status, "previous_status": previous},
        aggregate=("organization", organization.public_id),
        organization_id=organization.public_id,
    )
    logger.info("Organization %s organization=%s status=%s", action.split(".")[1], organization.public_id, new_status)


def verify_organization(organization: Organization, *, actor: Any = None) -> Organization:
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
            _change_organization_status(organization, Organization.Status.ACTIVE, "organization.verified", actor)
    return organization


def suspend_organization(organization: Organization, *, actor: Any = None) -> Organization:
    """Every member loses this workspace on their next request."""
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        if organization.status != Organization.Status.SUSPENDED:
            _change_organization_status(organization, Organization.Status.SUSPENDED, "organization.suspended", actor)
    return organization


def reinstate_organization(organization: Organization, *, actor: Any = None) -> Organization:
    """SUSPENDED -> ACTIVE, or back to PENDING if it was never verified."""
    with transaction.atomic():
        organization = Organization.objects.select_for_update().get(pk=organization.pk)
        if organization.status == Organization.Status.SUSPENDED:
            target = Organization.Status.ACTIVE if organization.verified_at else Organization.Status.PENDING
            _change_organization_status(organization, target, "organization.reinstated", actor)
    return organization


# --- Memberships --------------------------------------------------------------


def grant_membership(*, user: Any, organization: Organization, role: str, actor: Any = None) -> Membership:
    """Make `user` an active member with `role` (operators, demo data and fixtures)."""
    code = role_for(organization, role)
    with transaction.atomic():
        membership = Membership.objects.select_for_update().filter(user=user, organization=organization).first()
        if (
            membership is not None
            and membership.role_id == code
            and membership.status == Membership.Status.ACTIVE
            and membership.valid_from is None
            and membership.valid_to is None
        ):
            return membership
        membership, _ = Membership.objects.update_or_create(
            user=user,
            organization=organization,
            defaults={"role_id": code, "status": Membership.Status.ACTIVE, "valid_from": None, "valid_to": None},
        )
        record(
            "membership.granted",
            actor=actor,
            target=("membership", membership.public_id),
            details={"organization": str(organization.public_id), "role": code},
        )
        publish(
            events.MEMBERSHIP_GRANTED,
            {
                "membership_id": str(membership.public_id),
                "organization_id": str(organization.public_id),
                "user_id": str(user.public_id),
                "role": code,
            },
            aggregate=("membership", membership.public_id),
            organization_id=organization.public_id,
        )
    return membership


def set_membership_status(
    *, user: Any, organization: Organization, status_value: str, actor: Any = None
) -> Membership | None:
    """Suspend, revoke or reactivate a membership; the member's very next request reflects it."""
    if status_value not in {Membership.Status.ACTIVE, Membership.Status.SUSPENDED, Membership.Status.REVOKED}:
        raise _validation_error("status", "Choose active, suspended or revoked.")
    with transaction.atomic():
        membership = Membership.objects.select_for_update().filter(user=user, organization=organization).first()
        if membership is None:
            return None
        previous = membership.status
        if previous != status_value:
            membership.status = status_value
            membership.save(update_fields=["status", "updated_at"])
            record(
                "membership.status_changed",
                actor=actor,
                target=("membership", membership.public_id),
                details={"status": status_value, "previous_status": previous},
            )
            publish(
                events.MEMBERSHIP_STATUS_CHANGED,
                {
                    "membership_id": str(membership.public_id),
                    "organization_id": str(organization.public_id),
                    "user_id": str(user.public_id),
                    "status": status_value,
                    "previous_status": previous,
                },
                aggregate=("membership", membership.public_id),
                organization_id=organization.public_id,
            )
            logger.info(
                "Membership status changed membership=%s organization=%s status=%s",
                membership.public_id,
                organization.public_id,
                status_value,
            )
    return membership


# --- Invitations --------------------------------------------------------------


def _publish_revoked(invitation: Invitation) -> None:
    publish(
        events.INVITATION_REVOKED,
        {"invitation_id": str(invitation.public_id), "organization_id": str(invitation.organization.public_id)},
        aggregate=("invitation", invitation.public_id),
        organization_id=invitation.organization.public_id,
    )


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
    if organization.status != Organization.Status.ACTIVE:
        raise ApiError(
            "organization_unavailable",
            "Only verified, active organizations can invite members.",
            status.HTTP_409_CONFLICT,
        )
    code = role_for(organization, role)
    expires_at = timezone.now() + (ttl or settings.INVITATION_TTL)
    token = new_token()

    for attempt in range(1, _CREATE_ATTEMPTS + 1):
        try:
            with transaction.atomic():
                # Serialises invitations per organization: concurrent invites for one
                # address apply one after another, and the last one wins.
                Organization.objects.select_for_update().filter(pk=organization.pk).first()
                replaced = list(
                    Invitation.objects.select_related("organization").filter(
                        organization=organization, email=email, status=Invitation.Status.PENDING
                    )
                )
                now = timezone.now()
                for old in replaced:
                    old.status, old.revoked_at = Invitation.Status.REVOKED, now
                    old.save(update_fields=["status", "revoked_at", "updated_at"])
                    record(
                        "invitation.revoked",
                        actor=invited_by,
                        target=("invitation", old.public_id),
                        details={"reason": "replaced"},
                    )
                    _publish_revoked(old)
                invitation = Invitation.objects.create(
                    organization=organization,
                    email=email,
                    role_id=code,
                    token_hash=hash_token(token),
                    expires_at=expires_at,
                    invited_by=invited_by,
                )
                record(
                    "invitation.created",
                    actor=invited_by,
                    target=("invitation", invitation.public_id),
                    details={"organization": str(organization.public_id), "role": code},
                )
                payload: dict[str, Any] = {
                    "invitation_id": str(invitation.public_id),
                    "organization_id": str(organization.public_id),
                    "role": code,
                }
                if (inviter := _actor_public_id(invited_by)) is not None:
                    payload["invited_by"] = inviter
                publish(
                    events.INVITATION_CREATED,
                    payload,
                    aggregate=("invitation", invitation.public_id),
                    organization_id=organization.public_id,
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


def revoke_invitation(invitation: Invitation, *, actor: Any = None) -> Invitation:
    with transaction.atomic():
        invitation = Invitation.objects.select_for_update().select_related("organization").get(pk=invitation.pk)
        if invitation.status == Invitation.Status.PENDING:
            invitation.status = Invitation.Status.REVOKED
            invitation.revoked_at = timezone.now()
            invitation.save(update_fields=["status", "revoked_at", "updated_at"])
            record("invitation.revoked", actor=actor, target=("invitation", invitation.public_id))
            _publish_revoked(invitation)
            logger.info("Invitation revoked invitation=%s", invitation.public_id)
    return invitation


def invitation_state(invitation: Invitation) -> str:
    """pending, expired, accepted or revoked (expiry is evaluated now, not stored)."""
    if invitation.status == Invitation.Status.PENDING and invitation.expires_at <= timezone.now():
        return "expired"
    return str(invitation.status)


def accept_invitation(*, token: str, user: Any) -> Membership:
    """Join the invitation's organization; exactly one of any concurrent accepts succeeds.

    A refused attempt is audited (outcome "denied", with the refusal code).
    """
    seen: dict[str, Any] = {}
    try:
        return _accept(token, user, seen)
    except ApiError as exc:
        target = ("invitation", seen["invitation"]) if "invitation" in seen else None
        record("invitation.accept_refused", outcome="denied", actor=user, target=target, details={"code": exc.code})
        raise


def _accept(token: str, user: Any, seen: dict[str, Any]) -> Membership:
    with transaction.atomic():
        invitation = (
            Invitation.objects.select_for_update(of=("self",))
            .select_related("organization")
            .filter(token_hash=hash_token(token or ""))
            .first()
        )
        if invitation is not None:
            seen["invitation"] = invitation.public_id
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
            membership = Membership.objects.create(user=user, organization=organization, role_id=invitation.role_id)
        else:
            # A removed or suspended member re-invited by the organization comes back with the new role.
            membership.role_id = invitation.role_id
            membership.status = Membership.Status.ACTIVE
            membership.valid_from = None
            membership.valid_to = None
            membership.save(update_fields=["role", "status", "valid_from", "valid_to", "updated_at"])

        invitation.status = Invitation.Status.ACCEPTED
        invitation.accepted_by = user
        invitation.accepted_at = now
        invitation.save(update_fields=["status", "accepted_by", "accepted_at", "updated_at"])
        record(
            "invitation.accepted",
            actor=user,
            target=("invitation", invitation.public_id),
            details={"organization": str(organization.public_id), "role": invitation.role_id},
        )
        publish(
            events.INVITATION_ACCEPTED,
            {
                "invitation_id": str(invitation.public_id),
                "organization_id": str(organization.public_id),
                "membership_id": str(membership.public_id),
                "user_id": str(user.public_id),
                "role": invitation.role_id,
            },
            aggregate=("invitation", invitation.public_id),
            organization_id=organization.public_id,
        )

    logger.info(
        "Invitation accepted invitation=%s organization=%s membership=%s",
        invitation.public_id,
        organization.public_id,
        membership.public_id,
    )
    return membership
