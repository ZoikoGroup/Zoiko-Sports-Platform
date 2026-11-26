"""Read-only queries of the organizations module (the public read interface).

Workspace contexts are resolved here. A context exists only while:
- the account is active;
- for an organization workspace: the membership is ACTIVE, inside its validity
  window, and the organization is ACTIVE (verified, not suspended);
- for the Individual workspace: the account has an individual profile.

The sign-in tile, a stored session value or a client-supplied ID never creates
a context; they can only select one of these.
"""

from typing import Any
from uuid import UUID

from django.db.models import Q, QuerySet
from django.utils import timezone

from platform_core.workspace import INDIVIDUAL_CONTEXT_ID, WorkspaceContext

from .models import Invitation, Membership, Organization
from .tokens import hash_token

# Organization kind -> workspace (accounts.models.AccountType values).
KIND_TO_ACCOUNT_TYPE = {
    Organization.Kind.ORGANIZER: "organization",
    Organization.Kind.VENUE: "venue",
    Organization.Kind.CLUB: "club",
}
INDIVIDUAL_ACCOUNT_TYPE = "individual"
# Display order of contexts: the sign-in page's tile order, then organization name.
ACCOUNT_TYPE_ORDER = ("organization", "venue", "club", INDIVIDUAL_ACCOUNT_TYPE)

INDIVIDUAL_CONTEXT = WorkspaceContext(id=INDIVIDUAL_CONTEXT_ID, account_type=INDIVIDUAL_ACCOUNT_TYPE)


def active_memberships(user: Any) -> QuerySet[Membership]:
    """Memberships that currently grant a workspace (one query with their organization and role)."""
    now = timezone.now()
    return (
        Membership.objects.select_related("organization", "role")
        .filter(
            user=user,
            status=Membership.Status.ACTIVE,
            organization__status=Organization.Status.ACTIVE,
        )
        .filter(Q(valid_from__isnull=True) | Q(valid_from__lte=now))
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
    )


def _membership_context(membership: Membership) -> WorkspaceContext:
    organization = membership.organization
    return WorkspaceContext(
        id=str(organization.public_id),
        account_type=KIND_TO_ACCOUNT_TYPE[Organization.Kind(organization.kind)],
        organization_id=organization.pk,
        organization_public_id=organization.public_id,
        organization_name=organization.name,
        organization_kind=organization.kind,
        role=membership.role_id,
        role_name=membership.role.name,
    )


def _sort_key(context: WorkspaceContext) -> tuple[int, str, str]:
    return ACCOUNT_TYPE_ORDER.index(context.account_type), context.organization_name.casefold(), context.id


def eligible_contexts(user: Any) -> list[WorkspaceContext]:
    """Every workspace context the user may act in right now, in display order."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return []
    contexts = [_membership_context(m) for m in active_memberships(user)]
    if user.has_individual_profile:
        contexts.append(INDIVIDUAL_CONTEXT)
    return sorted(contexts, key=_sort_key)


def find_context(user: Any, context_id: str) -> WorkspaceContext | None:
    """The context with this ID if the user may act in it right now, else None (one query at most)."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return None
    if context_id == INDIVIDUAL_CONTEXT_ID:
        return INDIVIDUAL_CONTEXT if user.has_individual_profile else None
    try:
        organization_public_id = UUID(context_id)
    except (TypeError, ValueError, AttributeError):
        return None
    membership = active_memberships(user).filter(organization__public_id=organization_public_id).first()
    return _membership_context(membership) if membership is not None else None


def invitation_for_token(token: str) -> Invitation | None:
    """The invitation an emailed token belongs to (looked up by its hash), or None."""
    if not token:
        return None
    return Invitation.objects.select_related("organization", "role").filter(token_hash=hash_token(token)).first()


def organization_names(public_ids: list[str]) -> dict[str, str]:
    """Display names by organization public UUID (as strings); unknown IDs are left out."""
    valid = []
    for value in public_ids:
        try:
            valid.append(UUID(str(value)))
        except ValueError:
            continue
    rows = Organization.objects.filter(public_id__in=valid).values_list("public_id", "name")
    return {str(public_id): name for public_id, name in rows}
