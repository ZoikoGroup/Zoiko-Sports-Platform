"""Routes of the readiness API, included under /api/v1/venue-readiness/ in config/urls.py."""

from django.urls import URLPattern, path

from .views import UpdateRequestCreateView

app_name = "readiness"

urlpatterns: list[URLPattern] = [
    path("<uuid:readiness_id>/update-requests/", UpdateRequestCreateView.as_view(), name="update-requests"),
]
