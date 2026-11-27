"""Routes of the activity API, included under /api/v1/activity/ in config/urls.py."""

from django.urls import URLPattern, path

from .views import ActivityFeedView

app_name = "activity"

urlpatterns: list[URLPattern] = [
    path("", ActivityFeedView.as_view(), name="feed"),
]
