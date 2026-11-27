"""Request and response shapes of the readiness API."""

from rest_framework import serializers

from ..models import UpdateRequest
from ..services import MESSAGE_LIMIT


class UpdateRequestInputSerializer(serializers.Serializer):
    message = serializers.CharField(
        max_length=MESSAGE_LIMIT,
        allow_blank=True,
        trim_whitespace=True,
        help_text="What the venue should update, e.g. 'Upload the renewed fire safety certificate.'",
    )


class UpdateRequestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    readiness_id = serializers.UUIDField(source="readiness.public_id", read_only=True)

    class Meta:
        model = UpdateRequest
        fields = ["id", "readiness_id", "message", "created_at"]
        read_only_fields = fields
