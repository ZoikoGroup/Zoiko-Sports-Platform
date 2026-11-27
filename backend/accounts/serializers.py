from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AccountType, User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)
    account_type = serializers.ChoiceField(
        choices=AccountType.choices,
        required=False,
        allow_null=True,
        help_text=(
            "Preferred workspace (the sign-in tile). A preference only: it selects among the contexts the "
            "account's memberships grant and never grants one."
        ),
    )
    remember = serializers.BooleanField(default=False)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class TokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class PasswordResetConfirmSerializer(TokenSerializer):
    new_password = serializers.CharField(trim_whitespace=False)


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        candidate = User(email=attrs["email"], full_name=attrs["full_name"])
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:  # Django's error -> DRF field error
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


# --- Response shapes (OpenAPI documentation of what the views return) ---------


class StatusSerializer(serializers.Serializer):
    status = serializers.CharField(help_text="ok, accepted, verified or password_changed.")


class AccountTypeOptionSerializer(serializers.Serializer):
    id = serializers.ChoiceField(choices=AccountType.choices)
    # DRF's metaclass moves declared fields off the class, so this does not shadow Field.label.
    label = serializers.CharField()  # type: ignore[assignment]


class ProviderOptionSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    enabled = serializers.BooleanField()


class AuthConfigSerializer(serializers.Serializer):
    account_types = AccountTypeOptionSerializer(many=True)
    providers = ProviderOptionSerializer(many=True)
    passkeys_enabled = serializers.BooleanField()
    session_remember_days = serializers.IntegerField(help_text="Lifetime in days of a 'keep me signed in' session.")


class SessionUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()


class ContextOrganizationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    kind = serializers.CharField(help_text="organizer, venue or club.")


class WorkspaceContextSerializer(serializers.Serializer):
    id = serializers.CharField(help_text="`individual`, or the organization's ID.")
    account_type = serializers.ChoiceField(choices=AccountType.choices)
    organization = ContextOrganizationSerializer(allow_null=True)
    role = serializers.CharField(allow_null=True, help_text="Role code from the catalogue, e.g. venue_manager.")
    role_name = serializers.CharField(allow_null=True, help_text="The role's display name, e.g. Venue manager.")


CONTEXT_STATUSES = [
    ("active", "A context is active."),
    ("selection_required", "Several contexts (or none active): the user chooses one."),
    ("no_access", "The account has no context it may act in."),
]


class SessionSerializer(serializers.Serializer):
    """`authenticated` is always present; the other fields only when it is true."""

    authenticated = serializers.BooleanField()
    user = SessionUserSerializer(required=False)
    # DRF's metaclass moves declared fields off the class, so this does not shadow Serializer.context.
    context = WorkspaceContextSerializer(required=False, allow_null=True)  # type: ignore[assignment]
    contexts = WorkspaceContextSerializer(many=True, required=False)
    context_status = serializers.ChoiceField(choices=CONTEXT_STATUSES, required=False)
    context_ended = serializers.BooleanField(
        required=False, help_text="The previous context stopped being valid (membership or organization ended)."
    )
    permissions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Permission codes the active context's role grants (empty without an organization context).",
    )


class LoginResponseSerializer(SessionSerializer):
    preference_matched = serializers.BooleanField(
        allow_null=True, help_text="Whether the preferred workspace matched a context; null without a preference."
    )


class ContextSwitchSerializer(serializers.Serializer):
    # As above: a declared field, not a replacement of Serializer.context.
    context = serializers.CharField(max_length=64, help_text="ID of one of the user's contexts.")  # type: ignore[assignment]


class ContextListSerializer(serializers.Serializer):
    active = serializers.CharField(allow_null=True)
    contexts = WorkspaceContextSerializer(many=True)
