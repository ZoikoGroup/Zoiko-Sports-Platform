from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_core.errors import ApiError
from platform_core.filtering import parse_query_params
from platform_core.idempotency import idempotent
from platform_core.openapi import IDEMPOTENCY_KEY_PARAMETER, error_responses
from platform_core.pagination import CursorPage

from .. import selectors, services
from .serializers import ItemFilters, ItemSerializer, ItemUpdateSerializer


class ItemListView(APIView):
    pagination_class = CursorPage

    @extend_schema(parameters=[ItemFilters], responses={200: ItemSerializer(many=True), **error_responses(400, 401)})
    def get(self, request: Request) -> Response:
        filters = parse_query_params(request, ItemFilters)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(selectors.items_for(request.user, **filters), request, view=self)
        return paginator.get_paginated_response(ItemSerializer(page, many=True).data)

    @extend_schema(
        request=ItemSerializer,
        parameters=[IDEMPOTENCY_KEY_PARAMETER],
        responses={201: ItemSerializer, **error_responses(400, 401, 409, 422)},
    )
    @idempotent("reference.create_item")
    def post(self, request: Request) -> Response:
        serializer = ItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = services.create_item(request.user, **serializer.validated_data)
        return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)


class ItemDetailView(APIView):
    def _item(self, request: Request, item_id: UUID):
        item = selectors.item_for(request.user, item_id)
        if item is None:
            raise ApiError("not_found", "Not found.", status.HTTP_404_NOT_FOUND)
        return item

    @extend_schema(responses={200: ItemSerializer, **error_responses(401, 404)})
    def get(self, request: Request, item_id: UUID) -> Response:
        return Response(ItemSerializer(self._item(request, item_id)).data)

    @extend_schema(request=ItemUpdateSerializer, responses={200: ItemSerializer, **error_responses(400, 401, 404, 409)})
    def patch(self, request: Request, item_id: UUID) -> Response:
        item = self._item(request, item_id)
        serializer = ItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        changes = dict(serializer.validated_data)
        expected_version = changes.pop("version")
        if not changes:
            raise ApiError(
                "validation_error", "Nothing to change.", fields={"non_field_errors": ["Nothing to change."]}
            )
        item = services.update_item(item, expected_version=expected_version, changes=changes)
        return Response(ItemSerializer(item).data)


class FailingView(APIView):
    """Raises an unexpected error, to test the 500 envelope."""

    @extend_schema(responses={500: error_responses(500)[500]})
    def get(self, request: Request) -> Response:
        raise RuntimeError("reference failure with secret detail")
