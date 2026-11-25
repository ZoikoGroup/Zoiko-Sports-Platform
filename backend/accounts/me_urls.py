"""Routes under /api/v1/me/: the signed-in identity and its workspace context."""

from django.urls import URLPattern, path

from . import views

urlpatterns: list[URLPattern] = [
    path("", views.MeView.as_view()),
    path("contexts/", views.ContextListView.as_view()),
    path("context/", views.ContextView.as_view()),
]
