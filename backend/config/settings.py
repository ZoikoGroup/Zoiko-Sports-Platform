"""Django settings for the Zoiko Sports backend.

Values that differ per environment are read from environment variables so the
same settings module serves local, staging and production deployments.
"""

import os
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
    "platform_core",
    "accounts",
]

MIDDLEWARE = [
    # First: health probes are answered before host validation (see the module).
    "platform_core.middleware.HealthCheckMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Serves collected static files (Django admin) from the app server.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14  # "Keep me signed in" lifetime
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_HTTPONLY = False  # the SPA reads it to send X-CSRFToken
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

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
    },
    "EXCEPTION_HANDLER": "accounts.errors.exception_handler",
    # Behind a reverse proxy (nginx in Docker) throttling must key on the client
    # address from X-Forwarded-For, not the proxy's. 0 = no proxy (direct access).
    "NUM_PROXIES": int(env_str("DJANGO_NUM_PROXIES", "0")) or None,
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
    "formatters": {
        "json": {"()": "platform_core.logging.JsonFormatter"},
        "text": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": LOG_FORMAT}},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        # Replace Django's default handlers so records reach the root handler once.
        "django": {"handlers": [], "level": "INFO", "propagate": True},
        "django.request": {"level": "WARNING"},
        # Development-server request lines (runserver only), in the same format.
        "django.server": {"level": "INFO"},
    },
}
