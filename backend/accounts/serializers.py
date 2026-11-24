from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AccountType, Membership, User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)
    account_type = serializers.ChoiceField(choices=AccountType.choices)
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


class MembershipSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(source="organization.id")
    organization_name = serializers.CharField(source="organization.name")
    organization_kind = serializers.CharField(source="organization.kind")

    class Meta:
        model = Membership
        fields = ["organization_id", "organization_name", "organization_kind", "role"]


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


class SessionUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.CharField()


class SessionSerializer(serializers.Serializer):
    """`authenticated` is always present; the other fields only when it is true."""

    authenticated = serializers.BooleanField()
    user = SessionUserSerializer(required=False)
    account_type = serializers.ChoiceField(choices=AccountType.choices, required=False, allow_null=True)
    active_organization_id = serializers.IntegerField(required=False, allow_null=True)
    available_account_types = serializers.ListField(
        child=serializers.ChoiceField(choices=AccountType.choices), required=False
    )
    memberships = MembershipSerializer(many=True, required=False)


def session_payload(request) -> dict:
    user = request.user
    active_org_id = request.session.get("organization_id")
    return {
        "user": {
            "id": user.pk,
            "email": user.email,
            "full_name": user.full_name,
        },
        "account_type": request.session.get("account_type"),
        "active_organization_id": active_org_id,
        "available_account_types": user.available_account_types(),
        "memberships": MembershipSerializer(user.active_memberships(), many=True).data,
    }
