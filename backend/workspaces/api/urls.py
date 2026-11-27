"""Routes of the screen endpoints, included under /api/v1/ in config/urls.py."""

from django.urls import URLPattern, path

from ..organizer.venues import VenuesScreenView

app_name = "workspaces"

urlpatterns: list[URLPattern] = [
    path("organizer/venues/", VenuesScreenView.as_view(), name="organizer-venues"),
]
