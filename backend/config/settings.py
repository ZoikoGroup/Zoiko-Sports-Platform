"""Django settings for the Zoiko Sports backend.

Values that differ per environment are read from environment variables so the
same settings module serves local, staging and production deployments.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

from .database import DatabaseConfigError, database_from_env

BASE_DIR = Path(__file__).resolve().parent.parent


def env_str(name: str, default: str) -> str:
    """The variable's value, or `default` when it is unset or empty (as `KEY=` in .env)."""
    return os.environ.get(name, "").strip() or default


def env_bool(name: str, default: bool = False) -> bool:
    return env_str(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def env_int(name: str, default: int, minimum: int = 0, maximum: int | None = None) -> int:
    raw = env_str(name, str(default))
    try:
        value = int(raw)
    except ValueError:
        raise ImproperlyConfigured(f"{name} must be a whole number, not {raw!r}.") from None
    if value < minimum or (maximum is not None and value > maximum):
        upper = f" and at most {maximum}" if maximum is not None else ""
        raise ImproperlyConfigured(f"{name} must be at least {minimum}{upper}.")
    return value


# Processes started on the host (runserver, manage.py, tests) read backend/.env so
# they find the same database as Docker. Real environment variables always win,
# and the file is never copied into the image. Automation that must not pick up
# a developer's .env (CI, the end-to-end harness) sets DJANGO_READ_DOTENV=false.
if env_bool("DJANGO_READ_DOTENV", True):
    load_dotenv(BASE_DIR / ".env", override=False)


# Off unless explicitly enabled, so a deployment that forgets the setting never
# exposes debug pages. backend/.env.example enables it for local development.
DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env_str("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me" if DEBUG else "")
if not SECRET_KEY:
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off. "
        "For local development set DJANGO_DEBUG=true in backend/.env (see .env.example)."
    )

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "platform_core",
    "accounts",
    "organizations",
]

# `manage.py test` (also under coverage) adds the kernel's reference module: a
# test-only app that exercises the platform conventions through real HTTP calls.
TESTING = len(sys.argv) > 1 and sys.argv[1] == "test"
if TESTING:
    INSTALLED_APPS.append("platform_core.tests.reference")

MIDDLEWARE = [
    # First: every response and log line carries the request's correlation ID.
    "platform_core.middleware.RequestContextMiddleware",
    # Health probes are answered before host validation (see the module).
    "platform_core.middleware.HealthCheckMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Serves collected static files (Django admin) from the app server.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Re-checks the account and its workspace context on every request (P2).
    "accounts.middleware.WorkspaceContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# PostgreSQL 16 is the only supported database (see config/database.py).
try:
    DATABASES = {"default": database_from_env(os.environ)}
except DatabaseConfigError as exc:
    raise ImproperlyConfigured(str(exc)) from exc

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Argon2id (OWASP minimum cost, see accounts/hashers.py) for new passwords. The
# others only verify older hashes, which are upgraded at the next successful sign-in.
PASSWORD_HASHERS = [
    "accounts.hashers.Argon2idHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]
if TESTING:
    # Fast hashing keeps the suite quick; tests of hashing itself override this.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher", *PASSWORD_HASHERS]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Sessions & CSRF -------------------------------------------------------
# The SPA is served from the same origin (Vite proxy in development, nginx in
# the Docker stack), so cookie-based sessions are used. Cookies are Secure
# (HTTPS-only) unless DJANGO_SECURE_COOKIES=false, which local plain-HTTP
# deployments such as the Docker stack on http://localhost need.
SECURE_COOKIES = env_bool("DJANGO_SECURE_COOKIES", not DEBUG)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = SECURE_COOKIES
# "Keep me signed in" lifetime. Without it a session ends when the browser closes.
SESSION_REMEMBER_DAYS = env_int("SESSION_REMEMBER_DAYS", 14, minimum=1, maximum=90)
SESSION_COOKIE_AGE = 60 * 60 * 24 * SESSION_REMEMBER_DAYS
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_HTTPONLY = False  # the SPA reads it to send X-CSRFToken
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
# API paths answer a CSRF failure in the platform error envelope (csrf_failed).
CSRF_FAILURE_VIEW = "platform_core.errors.csrf_failure"

# --- Cache -----------------------------------------------------------------
# Rate-limit counters live in the cache. With several app-server workers (the
# Docker image runs gunicorn) they must share it, so DJANGO_CACHE_DIR selects a
# file cache on the data volume; local development keeps the in-memory default.
if os.environ.get("DJANGO_CACHE_DIR"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
            "LOCATION": os.environ["DJANGO_CACHE_DIR"],
        }
    }

# --- REST framework --------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "auth": env_str("AUTH_THROTTLE_RATE", "10/min"),
        "invitation": env_str("INVITATION_THROTTLE_RATE", "30/min"),
    },
    "EXCEPTION_HANDLER": "platform_core.errors.exception_handler",
    "DEFAULT_PAGINATION_CLASS": "platform_core.pagination.CursorPage",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Behind a reverse proxy (nginx in Docker) throttling must key on the client
    # address from X-Forwarded-For, not the proxy's. 0 = no proxy (direct access).
    "NUM_PROXIES": int(env_str("DJANGO_NUM_PROXIES", "0")) or None,
}

# --- Platform kernel conventions (platform_core) ---------------------------
# List endpoints: cursor pages of API_PAGE_SIZE rows, never more than API_MAX_PAGE_SIZE.
API_MAX_PAGE_SIZE = env_int("API_MAX_PAGE_SIZE", 100, minimum=1, maximum=1000)
API_PAGE_SIZE = env_int("API_PAGE_SIZE", min(25, API_MAX_PAGE_SIZE), minimum=1, maximum=API_MAX_PAGE_SIZE)
# How long a stored Idempotency-Key outcome is replayed (platform_core.idempotency).
IDEMPOTENCY_TTL = timedelta(hours=env_int("IDEMPOTENCY_TTL_HOURS", 24, minimum=1, maximum=24 * 30))

# --- Organizations and invitations (organizations module) -------------------
# How long an emailed invitation link stays valid.
INVITATION_TTL = timedelta(days=env_int("INVITATION_TTL_DAYS", 7, minimum=1, maximum=30))

# --- API documentation (OpenAPI 3, drf-spectacular) --------------------------
# The schema is generated from the code; backend/openapi.yaml is the reviewed copy
# and CI fails when the two differ. Served at /api/v1/schema/ only with DEBUG on.
SPECTACULAR_SETTINGS = {
    "TITLE": "Zoiko Sports API",
    "DESCRIPTION": (
        'Conventions: errors use {"error": {code, message, request_id, fields?}}; every response carries '
        "X-Request-ID; lists use cursor pagination ({next, previous, results}); creates take an "
        "Idempotency-Key header; edits state the `version` they are based on and get 409 version_conflict "
        "when it moved; instants are RFC 3339 in UTC; time zones are IANA names."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    # One schema name per shared choice set.
    "ENUM_NAME_OVERRIDES": {
        "AccountTypeEnum": "accounts.models.AccountType",
        "ContextStatusEnum": "accounts.serializers.CONTEXT_STATUSES",
        "OrganizationKindEnum": "organizations.models.Organization.Kind",
        "InvitationStateEnum": "organizations.api.serializers.INVITATION_STATES",
    },
}

# --- Email -----------------------------------------------------------------
EMAIL_BACKEND = env_str("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_FILE_PATH = os.environ.get("DJANGO_EMAIL_FILE_PATH", BASE_DIR / "tmp" / "emails")  # filebased backend only
DEFAULT_FROM_EMAIL = env_str("DJANGO_DEFAULT_FROM_EMAIL", "Zoiko Sports <no-reply@zoikosports.local>")
# SMTP (used when DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend)
EMAIL_HOST = env_str("DJANGO_EMAIL_HOST", "localhost")
EMAIL_PORT = int(env_str("DJANGO_EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("DJANGO_EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("DJANGO_EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("DJANGO_EMAIL_USE_TLS", True)

# Public URL of the frontend, used to build links in password-reset and
# verification emails.
FRONTEND_URL = env_str("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# --- Federated sign-in -----------------------------------------------------
# A provider is offered as active only once its credentials are configured.
# Until then the API reports it as unavailable and the UI says so honestly.
AUTH_PROVIDERS = {
    "google": {"name": "Google", "enabled": bool(os.environ.get("AUTH_GOOGLE_CLIENT_ID"))},
    "microsoft": {"name": "Microsoft", "enabled": bool(os.environ.get("AUTH_MICROSOFT_CLIENT_ID"))},
    "apple": {"name": "Apple", "enabled": bool(os.environ.get("AUTH_APPLE_CLIENT_ID"))},
    "sso": {"name": "Company SSO", "enabled": bool(os.environ.get("AUTH_SSO_METADATA_URL"))},
}
AUTH_PASSKEYS_ENABLED = env_bool("AUTH_PASSKEYS_ENABLED", False)

# --- Logging ---------------------------------------------------------------
# One handler on the root logger, so every module's logs share one format:
# "json" (one object per line, for log collectors; the default when DEBUG is
# off) or "text" (readable in a terminal; the default when DEBUG is on).
LOG_FORMAT = env_str("DJANGO_LOG_FORMAT", "text" if DEBUG else "json").lower()
if LOG_FORMAT not in {"json", "text"}:
    raise ImproperlyConfigured("DJANGO_LOG_FORMAT must be json or text.")
LOG_LEVEL = env_str("DJANGO_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    # Adds `request_id` (the request's correlation ID) to every record.
    "filters": {"request_context": {"()": "platform_core.logging.RequestContextFilter"}},
    "formatters": {
        "json": {"()": "platform_core.logging.JsonFormatter"},
        "text": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": LOG_FORMAT, "filters": ["request_context"]}
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        # Replace Django's default handlers so records reach the root handler once.
        "django": {"handlers": [], "level": "INFO", "propagate": True},
        "django.request": {"level": "WARNING"},
        # Development-server request lines (runserver only), in the same format.
        "django.server": {"level": "INFO"},
    },
}
