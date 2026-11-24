from rest_framework import serializers

from platform_core.concurrency import VersionField
from platform_core.fields import AwareDateTimeField, TimeZoneField
from platform_core.filtering import SearchQueryField

from ..models import ReferenceItem


class ItemSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    title = serializers.CharField(max_length=200)
    status = serializers.ChoiceField(choices=ReferenceItem.Status.choices, default=ReferenceItem.Status.DRAFT)
    starts_at = AwareDateTimeField()
    time_zone = TimeZoneField()
    version = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class ItemUpdateSerializer(serializers.Serializer):
    version = VersionField()
    title = serializers.CharField(max_length=200, required=False)
    status = serializers.ChoiceField(choices=ReferenceItem.Status.choices, required=False)
    starts_at = AwareDateTimeField(required=False)
    time_zone = TimeZoneField(required=False)


class ItemFilters(serializers.Serializer):
    q = SearchQueryField()
    status = serializers.ChoiceField(choices=ReferenceItem.Status.choices, required=False)
