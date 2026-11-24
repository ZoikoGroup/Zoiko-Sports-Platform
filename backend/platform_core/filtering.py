"""Query-parameter filtering convention for list endpoints.

A list declares its filters as a serializer and validates the query string with
`parse_query_params`:

    class CompetitionFilters(serializers.Serializer):
        q = SearchQueryField()
        status = serializers.ChoiceField(choices=[...], required=False)

    filters = parse_query_params(request, CompetitionFilters)

- `q` is the free-text search parameter on every list that searches.
- Unknown parameters are rejected (400 validation_error) instead of being
  ignored, so a misspelt filter can never silently return unfiltered data.
- A parameter may appear once, unless its field is a list (ListField or
  MultipleChoiceField), which receives every value.
- `cursor` and `page_size` belong to pagination (platform_core.pagination) and are
  always accepted.
"""

from typing import Any

from rest_framework import serializers
from rest_framework.request import Request

from .errors import ApiError

PAGINATION_PARAMS = frozenset({"cursor", "page_size"})
SEARCH_MAX_LENGTH = 200


class SearchQueryField(serializers.CharField):
    """The `q` text-search parameter: trimmed, optional, at most 200 characters."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_blank", True)
        kwargs.setdefault("max_length", SEARCH_MAX_LENGTH)
        kwargs.setdefault("help_text", "Free-text search.")
        super().__init__(**kwargs)


def parse_query_params(request: Request, filters: type[serializers.Serializer]) -> dict[str, Any]:
    """The validated filter values from the query string, or a 400 validation_error."""
    fields = filters().fields
    params = request.query_params
    errors: dict[str, list[str]] = {}
    data: dict[str, Any] = {}
    for name in params:
        if name in PAGINATION_PARAMS:
            continue
        field = fields.get(name)
        if field is None:
            errors[name] = ["Unknown query parameter."]
            continue
        values = params.getlist(name)
        if isinstance(field, (serializers.ListField, serializers.MultipleChoiceField)):
            data[name] = values
        elif len(values) > 1:
            errors[name] = ["Give this parameter only once."]
        else:
            data[name] = values[0]
    if errors:
        raise ApiError("validation_error", "Please correct the highlighted fields.", fields=errors)
    serializer = filters(data=data)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)
