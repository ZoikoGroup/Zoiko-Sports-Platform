"""Request and response shapes of the organizations API (invitations)."""

from rest_framework import serializers

from ..models import Organization

INVITATION_STATES = [
    ("pending", "Can be accepted."),
    ("expired", "Past its expiry; ask for a new invitation."),
    ("accepted", "Already used."),
]


class InvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128, trim_whitespace=True, help_text="The token from the emailed link.")


class InvitationOrganizationSerializer(serializers.Serializer):
    name = serializers.CharField()
    kind = serializers.ChoiceField(choices=Organization.Kind.choices)


class InvitationPreviewSerializer(serializers.Serializer):
    organization = InvitationOrganizationSerializer()
    account_type = serializers.CharField(help_text="The workspace the invitation opens: organization, venue or club.")
    role = serializers.CharField()
    role_name = serializers.CharField(help_text="The role's display name from the catalogue.")
    email = serializers.CharField(help_text="The invited address, partly masked.")
    expires_at = serializers.DateTimeField()
    state = serializers.ChoiceField(choices=INVITATION_STATES)


def mask_email(email: str) -> str:
    """o*****@example.com: enough to recognise the address, not to harvest it."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}{'*' * max(len(local) - 1, 3)}@{domain}"
