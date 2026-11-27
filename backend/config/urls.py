from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path

urlpatterns: list[URLPattern | URLResolver] = [
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/me/", include("accounts.me_urls")),
    path("api/v1/invitations/", include("organizations.api.urls")),
    path("api/v1/activity/", include("activity.api.urls")),
    path("api/v1/health/", include("platform_core.urls")),
]

if settings.ADMIN_ENABLED:
    # Zoiko staff only (is_staff), at a configurable path; off by default outside development (P3.9).
    urlpatterns.append(path(settings.ADMIN_PATH, admin.site.urls))

if settings.DEBUG:
    # The OpenAPI schema, for local tooling only; production does not publish its API map.
    from drf_spectacular.views import SpectacularAPIView

    urlpatterns.append(path("api/v1/schema/", SpectacularAPIView.as_view(), name="openapi-schema"))

# /api/ paths answer in the platform error envelope; other paths keep Django's pages.
handler400 = "platform_core.errors.bad_request"
handler403 = "platform_core.errors.permission_denied"
handler404 = "platform_core.errors.not_found"
handler500 = "platform_core.errors.server_error"
