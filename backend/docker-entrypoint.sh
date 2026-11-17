#!/bin/sh
# Prepares the container before the app server starts:
#  1. secret key: DJANGO_SECRET_KEY if provided, otherwise a random key generated
#     once and kept on the data volume (so sessions survive restarts);
#  2. database migrations;
#  3. optional demo accounts (ZS_SEED_DEMO=true, password from ZS_DEMO_PASSWORD).
set -eu

if [ -z "${DJANGO_SECRET_KEY:-}" ]; then
  key_file=/app/data/.secret_key
  if [ ! -s "$key_file" ]; then
    python -c "import secrets; print(secrets.token_urlsafe(50))" > "$key_file"
    chmod 600 "$key_file"
  fi
  DJANGO_SECRET_KEY=$(cat "$key_file")
  export DJANGO_SECRET_KEY
fi

if [ -n "${DJANGO_CACHE_DIR:-}" ]; then
  mkdir -p "$DJANGO_CACHE_DIR"
fi

python manage.py migrate --noinput

if [ "${ZS_SEED_DEMO:-false}" = "true" ]; then
  ZS_ALLOW_DEMO_SEED=true python manage.py seed_demo
fi

exec "$@"
