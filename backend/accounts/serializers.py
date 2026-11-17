from django.contrib.auth import password_validation
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
        except Exception as exc:  # django ValidationError -> field error
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs


class MembershipSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(source="organization.id")
    organization_name = serializers.CharField(source="organization.name")
    organization_kind = serializers.CharField(source="organization.kind")

    class Meta:
        model = Membership
        fields = ["organization_id", "organization_name", "organization_kind", "role"]


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
