"""Django settings for the Zoiko Sports backend.

Values that differ per environment are read from environment variables so the
same settings module serves local, staging and production deployments.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me" if DEBUG else "")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
]

MIDDLEWARE = [
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("DJANGO_SQLITE_PATH", BASE_DIR / "db.sqlite3"),
    }
}

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
        "auth": os.environ.get("AUTH_THROTTLE_RATE", "10/min"),
    },
    "EXCEPTION_HANDLER": "accounts.errors.exception_handler",
    # Behind a reverse proxy (nginx in Docker) throttling must key on the client
    # address from X-Forwarded-For, not the proxy's. 0 = no proxy (direct access).
    "NUM_PROXIES": int(os.environ.get("DJANGO_NUM_PROXIES", "0")) or None,
}

# --- Email -----------------------------------------------------------------
EMAIL_BACKEND = os.environ.get("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_FILE_PATH = os.environ.get("DJANGO_EMAIL_FILE_PATH", BASE_DIR / "tmp" / "emails")  # filebased backend only
DEFAULT_FROM_EMAIL = os.environ.get("DJANGO_DEFAULT_FROM_EMAIL", "Zoiko Sports <no-reply@zoikosports.local>")
# SMTP (used when DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend)
EMAIL_HOST = os.environ.get("DJANGO_EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("DJANGO_EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("DJANGO_EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("DJANGO_EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("DJANGO_EMAIL_USE_TLS", True)

# Public URL of the frontend, used to build links in password-reset and
# verification emails.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

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

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "accounts": {"handlers": ["console"], "level": "INFO"},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}
