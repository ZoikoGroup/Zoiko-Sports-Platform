"""PostgreSQL connection settings built from environment variables.

Kept free of Django imports so settings.py can call it before Django is set up,
and so it can be unit-tested without a database.

Variables (all optional; host processes may also read them from backend/.env):
  DATABASE_HOST, DATABASE_PORT          default 127.0.0.1, 5432
  DATABASE_NAME, DATABASE_USER          default POSTGRES_DB / POSTGRES_USER, else "zoiko"
  DATABASE_PASSWORD                     default POSTGRES_PASSWORD, else empty
  DATABASE_SSLMODE                      libpq sslmode (e.g. require, verify-full); unset = libpq default
  DATABASE_CONNECT_TIMEOUT              seconds, default 5
  DATABASE_POOL                         true (default) uses Django's psycopg connection pool
  DATABASE_POOL_MIN_SIZE / _MAX_SIZE    default 1 / 10 connections per process
  DATABASE_POOL_TIMEOUT                 seconds to wait for a pooled connection, default 10
  DATABASE_CONN_MAX_AGE                 seconds to keep a connection without the pool, default 60
  DATABASE_TEST_NAME                    name of the test database (default: test_<name>)
"""

from collections.abc import Mapping
from typing import Any

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


class DatabaseConfigError(ValueError):
    """A database environment variable has an invalid value."""


def _bool(env: Mapping[str, str], key: str, default: bool) -> bool:
    raw = env.get(key, "").strip().lower()
    if not raw:
        return default
    if raw in TRUE_VALUES:
        return True
    if raw in FALSE_VALUES:
        return False
    raise DatabaseConfigError(f"{key} must be true or false, not {raw!r}.")


def _int(env: Mapping[str, str], key: str, default: int, minimum: int = 0) -> int:
    raw = env.get(key, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise DatabaseConfigError(f"{key} must be a whole number, not {raw!r}.") from None
    if value < minimum:
        raise DatabaseConfigError(f"{key} must be at least {minimum}.")
    return value


def database_from_env(env: Mapping[str, str]) -> dict[str, Any]:
    """The `default` entry of Django's DATABASES setting."""
    options: dict[str, Any] = {
        "connect_timeout": _int(env, "DATABASE_CONNECT_TIMEOUT", 5, minimum=1),
        "application_name": "zoiko-sports",
    }
    sslmode = env.get("DATABASE_SSLMODE", "").strip()
    if sslmode:
        options["sslmode"] = sslmode

    pooled = _bool(env, "DATABASE_POOL", True)
    if pooled:
        min_size = _int(env, "DATABASE_POOL_MIN_SIZE", 1)
        max_size = _int(env, "DATABASE_POOL_MAX_SIZE", 10, minimum=1)
        if min_size > max_size:
            raise DatabaseConfigError("DATABASE_POOL_MIN_SIZE cannot exceed DATABASE_POOL_MAX_SIZE.")
        options["pool"] = {
            "min_size": min_size,
            "max_size": max_size,
            "timeout": _int(env, "DATABASE_POOL_TIMEOUT", 10, minimum=1),
        }

    config: dict[str, Any] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.get("DATABASE_NAME") or env.get("POSTGRES_DB") or "zoiko",
        "USER": env.get("DATABASE_USER") or env.get("POSTGRES_USER") or "zoiko",
        "PASSWORD": env.get("DATABASE_PASSWORD") or env.get("POSTGRES_PASSWORD") or "",
        "HOST": env.get("DATABASE_HOST") or "127.0.0.1",
        "PORT": str(_int(env, "DATABASE_PORT", 5432, minimum=1)),
        # The pool manages connection reuse itself and requires CONN_MAX_AGE = 0.
        "CONN_MAX_AGE": 0 if pooled else _int(env, "DATABASE_CONN_MAX_AGE", 60),
        "CONN_HEALTH_CHECKS": not pooled,
        "OPTIONS": options,
    }
    test_name = env.get("DATABASE_TEST_NAME", "").strip()
    if test_name:
        config["TEST"] = {"NAME": test_name}
    return config
