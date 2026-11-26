"""Request and response shapes of the activity API."""

from rest_framework import serializers

from ..models import ActivityEntry


class ActivityEntrySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    kind = serializers.CharField(help_text="Event type the entry was built from, e.g. invitation.accepted.")
    summary = serializers.CharField(help_text="One readable line, e.g. 'Casey Club joined Club A as Club coordinator.'")

    class Meta:
        model = ActivityEntry
        fields = ["id", "occurred_at", "kind", "summary"]
        read_only_fields = fields
