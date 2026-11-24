"""Serializer fields for the platform's API conventions."""

from datetime import UTC, datetime
from typing import Any

from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from .timeutils import InvalidTimeZoneError, get_time_zone


class TimeZoneField(serializers.CharField):
    """An IANA time-zone name such as "Europe/London" (validated against the tz database)."""

    default_error_messages = {
        "invalid_time_zone": "Enter a valid IANA time zone, for example Europe/London.",
    }

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("max_length", 64)
        kwargs.setdefault("help_text", "IANA time-zone name, for example Europe/London.")
        super().__init__(**kwargs)

    def to_internal_value(self, data: Any) -> str:
        value: str = super().to_internal_value(data)
        try:
            get_time_zone(value)
        except InvalidTimeZoneError:
            self.fail("invalid_time_zone")
        return value


class AwareDateTimeField(serializers.DateTimeField):
    """An instant in RFC 3339 with an explicit offset; stored and returned in UTC ("Z").

    DRF's DateTimeField would silently read "2027-06-12T18:00:00" as server
    time. An instant without an offset is ambiguous, so it is rejected.
    """

    default_error_messages = {
        "naive": "Include a UTC offset, for example 2027-06-12T18:00:00Z.",
    }

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("default_timezone", UTC)
        kwargs.setdefault(
            "help_text", "RFC 3339 date-time with an offset; returned in UTC, for example 2027-06-12T18:00:00Z."
        )
        super().__init__(**kwargs)

    def to_internal_value(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            parsed: datetime | None = value
        elif isinstance(value, str):
            try:
                parsed = parse_datetime(value.strip())
            except ValueError:
                parsed = None
        else:
            parsed = None
        if parsed is None:
            self.fail("invalid", format="RFC 3339 (for example 2027-06-12T18:00:00Z)")
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            self.fail("naive")
        return parsed.astimezone(UTC)
