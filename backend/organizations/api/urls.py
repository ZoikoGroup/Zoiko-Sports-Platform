"""Routes of the organizations API, included under /api/v1/invitations/ in config/urls.py."""

from django.urls import URLPattern, path

from . import views

app_name = "organizations"

urlpatterns: list[URLPattern] = [
    path("preview/", views.InvitationPreviewView.as_view(), name="invitation-preview"),
    path("accept/", views.InvitationAcceptView.as_view(), name="invitation-accept"),
]
