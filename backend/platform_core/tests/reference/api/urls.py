"""Test URL configuration: the real routes plus the reference module's."""

from django.urls import path

from config.urls import handler400, handler403, handler404, handler500
from config.urls import urlpatterns as base_urlpatterns

from .views import FailingView, ItemDetailView, ItemListView

__all__ = ["handler400", "handler403", "handler404", "handler500", "urlpatterns"]

urlpatterns = [
    *base_urlpatterns,
    path("api/v1/reference/items/", ItemListView.as_view(), name="reference-items"),
    path("api/v1/reference/items/<uuid:item_id>/", ItemDetailView.as_view(), name="reference-item"),
    path("api/v1/reference/failing/", FailingView.as_view(), name="reference-failing"),
]
