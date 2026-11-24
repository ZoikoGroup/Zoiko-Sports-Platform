"""Cursor (keyset) pagination: the platform's list convention.

    GET /api/v1/<things>/?page_size=25&cursor=<opaque>
    {"next": "<url or null>", "previous": "<url or null>", "results": [...]}

A cursor holds the sort values of the row at the edge of a page, and the next
page is "rows after these values" (a keyset condition), never "skip N rows".
So every page costs one indexed query however deep the client scrolls, and rows
added or removed while scrolling never cause repeats or gaps.

- The sort order must end with a unique field; the default (-created_at, -id) is
  newest first with the primary key breaking ties, so rows sharing a timestamp
  are still returned exactly once, forwards and backwards. A list with another
  order passes its own, for example CursorPage(ordering=("starts_at", "id")).
- Page size defaults to API_PAGE_SIZE and is capped at API_MAX_PAGE_SIZE
  (larger requests get the maximum; invalid ones the default).
- A malformed or tampered cursor is 400 `invalid_cursor` (404 is reserved for
  "this resource is not visible to you").

Views declare `pagination_class = CursorPage` so the OpenAPI schema documents
the page shape and the `cursor` / `page_size` parameters.
"""

import base64
import binascii
import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db.models import Field, Model, Q, QuerySet
from rest_framework import status
from rest_framework.pagination import BasePagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.utils.urls import remove_query_param, replace_query_param

from .errors import ApiError

MAX_CURSOR_LENGTH = 1024


@dataclass(frozen=True)
class _Key:
    name: str
    descending: bool
    field: Field


@dataclass(frozen=True)
class _Cursor:
    values: tuple[Any, ...]
    backwards: bool


def _invalid_cursor() -> ApiError:
    return ApiError(
        "invalid_cursor",
        "This page link is no longer valid. Start again from the first page.",
        status.HTTP_400_BAD_REQUEST,
    )


class CursorPage(BasePagination):
    cursor_query_param = "cursor"
    page_size_query_param = "page_size"
    ordering: tuple[str, ...] = ("-created_at", "-id")

    def __init__(self, ordering: Sequence[str] | None = None) -> None:
        if ordering is not None:
            self.ordering = tuple(ordering)
        self.page_size: int = settings.API_PAGE_SIZE
        self.max_page_size: int = settings.API_MAX_PAGE_SIZE
        self.next_url: str | None = None
        self.previous_url: str | None = None

    # --- ordering ---------------------------------------------------------

    def _keys(self, model: type[Model]) -> list[_Key]:
        if not self.ordering:
            raise ImproperlyConfigured("CursorPage needs an ordering.")
        keys = []
        for entry in self.ordering:
            name = entry.lstrip("-")
            field = model._meta.pk if name == "pk" else model._meta.get_field(name)
            if not isinstance(field, Field) or field.is_relation or field.null:
                raise ImproperlyConfigured(f"CursorPage ordering field {name!r} must be a non-null, local column.")
            keys.append(_Key(name, entry.startswith("-"), field))
        last = keys[-1].field
        if not (last.primary_key or last.unique):
            raise ImproperlyConfigured("CursorPage ordering must end with a unique field (for example id).")
        return keys

    # --- page size ---------------------------------------------------------

    def get_page_size(self, request: Request) -> int:
        raw = request.query_params.get(self.page_size_query_param)
        if raw is not None:
            try:
                requested = int(raw)
            except ValueError:
                return self.page_size
            if requested > 0:
                return min(requested, self.max_page_size)
        return self.page_size

    # --- cursor encoding ----------------------------------------------------

    def _encode(self, keys: list[_Key], row: Model, backwards: bool) -> str:
        values = [key.field.value_to_string(row) for key in keys]
        payload = json.dumps({"v": values, "b": backwards}, separators=(",", ":"))
        return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")

    def _decode(self, request: Request, keys: list[_Key]) -> _Cursor | None:
        encoded = request.query_params.get(self.cursor_query_param)
        if encoded is None:
            return None
        if not encoded or len(encoded) > MAX_CURSOR_LENGTH:
            raise _invalid_cursor()
        try:
            raw = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True)
            payload = json.loads(raw)
            values, backwards = payload["v"], payload["b"]
            if not isinstance(values, list) or len(values) != len(keys) or not isinstance(backwards, bool):
                raise ValueError("cursor shape")
            if not all(isinstance(value, str) for value in values):
                raise ValueError("cursor values")
            converted = tuple(key.field.to_python(value) for key, value in zip(keys, values, strict=True))
        except (binascii.Error, UnicodeDecodeError, ValueError, KeyError, TypeError, ValidationError):
            raise _invalid_cursor() from None
        return _Cursor(converted, backwards)

    # --- query ----------------------------------------------------------------

    @staticmethod
    def _beyond(keys: list[_Key], values: tuple[Any, ...], backwards: bool) -> Q:
        """Rows strictly beyond `values` in the walking direction (lexicographic keyset condition)."""
        condition = Q(pk__in=[])
        for index, key in enumerate(keys):
            descending = key.descending != backwards
            step = Q(**{f"{key.name}__{'lt' if descending else 'gt'}": values[index]})
            for earlier, value in zip(keys[:index], values[:index], strict=True):
                step &= Q(**{earlier.name: value})
            condition |= step
        return condition

    def paginate_queryset(
        self, queryset: QuerySet[Any] | Sequence[Any], request: Request, view: Any = None
    ) -> list[Any]:
        if not isinstance(queryset, QuerySet):
            raise TypeError("CursorPage paginates querysets (the keyset condition runs in the database).")
        self.request = request
        keys = self._keys(queryset.model)
        size = self.get_page_size(request)
        cursor = self._decode(request, keys)
        backwards = cursor is not None and cursor.backwards

        order = [f"{'-' if key.descending != backwards else ''}{key.name}" for key in keys]
        rows_query = queryset.order_by(*order)
        if cursor is not None:
            rows_query = rows_query.filter(self._beyond(keys, cursor.values, backwards))
        rows = list(rows_query[: size + 1])
        more = len(rows) > size
        rows = rows[:size]
        if backwards:
            rows.reverse()
            has_previous, has_next = more, True
        else:
            has_previous, has_next = cursor is not None, more

        url = request.build_absolute_uri()
        self.next_url = (
            replace_query_param(url, self.cursor_query_param, self._encode(keys, rows[-1], False))
            if has_next and rows
            else None
        )
        if has_previous and rows:
            self.previous_url = replace_query_param(url, self.cursor_query_param, self._encode(keys, rows[0], True))
        elif has_previous:
            self.previous_url = remove_query_param(url, self.cursor_query_param)
        else:
            self.previous_url = None
        return rows

    def get_paginated_response(self, data: Any) -> Response:
        return Response({"next": self.next_url, "previous": self.previous_url, "results": data})

    # --- OpenAPI ------------------------------------------------------------

    def get_paginated_response_schema(self, schema: dict[str, Any]) -> dict[str, Any]:
        link = {"type": "string", "nullable": True, "format": "uri"}
        return {
            "type": "object",
            "required": ["results"],
            "properties": {"next": link, "previous": link, "results": schema},
        }

    def get_schema_operation_parameters(self, view: Any) -> list[dict[str, Any]]:
        return [
            {
                "name": self.cursor_query_param,
                "required": False,
                "in": "query",
                "description": "Opaque position from a previous page's next/previous link.",
                "schema": {"type": "string"},
            },
            {
                "name": self.page_size_query_param,
                "required": False,
                "in": "query",
                "description": f"Rows per page (default {self.page_size}, at most {self.max_page_size}).",
                "schema": {"type": "integer"},
            },
        ]
