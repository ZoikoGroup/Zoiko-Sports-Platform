#!/usr/bin/env bash
# Zoiko Sports backend CI pipeline. Every step must pass; the first failure stops it.
#
#   lint → format → types → Django checks (incl. module boundaries) → tracker → migrations
#   complete → API schema matches openapi.yaml → tests + coverage
#   → dependency audit → image build → image vulnerability scan
#
# Run from anywhere (Git Bash on Windows, or any Linux/macOS shell):
#   backend/scripts/ci.sh
#
# Database: if DATABASE_HOST is set (e.g. a CI service container), the DATABASE_*
# variables are used as given. Otherwise a throwaway PostgreSQL 16 container with
# a random password is started on a free local port and removed afterwards.
#
# Environment:
#   PYTHON           interpreter to use (default: backend/.venv, else python)
#   CI_SKIP_IMAGE=1  skip the image build and scan (no Docker daemon available)
set -euo pipefail

cd "$(dirname "$0")/.."

POSTGRES_IMAGE="postgres:16-bookworm"
# Pinned by digest (aquasec/trivy:0.69.1) so the scanner itself cannot change underneath us.
TRIVY_IMAGE="aquasec/trivy@sha256:1c78ed1ef824ab8bb05b04359d186e4c1229d0b3e67005faacb54a7d71974f73"
APP_IMAGE="zoiko-sports-backend:ci"

if [ -z "${PYTHON:-}" ]; then
  for candidate in .venv/Scripts/python.exe .venv/bin/python; do
    if [ -x "$candidate" ]; then PYTHON=$candidate; break; fi
  done
fi
PYTHON=${PYTHON:-python}

# Never pick up a developer's backend/.env; CI is configured explicitly.
export DJANGO_READ_DOTENV=false
export DJANGO_SETTINGS_MODULE=config.settings
# Development settings for checks and tests (the test runner itself always runs
# with DEBUG off). Debug is off by default, so CI states what it needs.
export DJANGO_DEBUG="${DJANGO_DEBUG:-true}"

started=$(date +%s)
step() { printf '\n==> %s\n' "$*"; }

pg_container=""
work_dir=$(mktemp -d)
cleanup() {
  if [ -n "$pg_container" ]; then docker rm -f "$pg_container" >/dev/null 2>&1 || true; fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

step "Python: $("$PYTHON" --version)"

step "Lint (ruff)"
"$PYTHON" -m ruff check .

step "Format (ruff)"
"$PYTHON" -m ruff format --check .

step "Types (mypy)"
"$PYTHON" -m mypy .

if [ -z "${DATABASE_HOST:-}" ]; then
  step "Database: throwaway $POSTGRES_IMAGE"
  password=$("$PYTHON" -c 'import secrets; print(secrets.token_urlsafe(24))')
  pg_container=$(docker run -d --rm --label zoiko-sports.ci=1 \
    -e POSTGRES_USER=zoiko -e POSTGRES_DB=zoiko -e POSTGRES_PASSWORD="$password" \
    -p 127.0.0.1::5432 "$POSTGRES_IMAGE")
  for _ in $(seq 1 60); do
    if docker exec "$pg_container" pg_isready -U zoiko -d zoiko >/dev/null 2>&1; then break; fi
    sleep 1
  done
  port=$(docker port "$pg_container" 5432/tcp | head -n 1 | sed 's/.*://')
  export DATABASE_HOST=127.0.0.1 DATABASE_PORT="$port" DATABASE_NAME=zoiko DATABASE_USER=zoiko DATABASE_PASSWORD="$password"
fi
"$PYTHON" manage.py wait_for_db --timeout 60

step "Django system checks"
"$PYTHON" manage.py check --fail-level WARNING

step "Implementation tracker (backend/docs)"
"$PYTHON" manage.py check_tracker

step "Migrations match the models"
"$PYTHON" manage.py makemigrations --check --dry-run

step "API schema (OpenAPI): zero warnings, matches openapi.yaml"
"$PYTHON" manage.py spectacular --validate --fail-on-warn --file "$work_dir/openapi.yaml"
if ! diff -u --strip-trailing-cr openapi.yaml "$work_dir/openapi.yaml"; then
  echo "The API changed but openapi.yaml did not. Review the change, then run:" >&2
  echo "  python manage.py spectacular --file openapi.yaml" >&2
  exit 1
fi

step "Tests with coverage"
"$PYTHON" -m coverage erase
"$PYTHON" -m coverage run manage.py test --noinput
"$PYTHON" -m coverage report

step "Dependency audit (pip-audit)"
"$PYTHON" -m pip_audit --strict --require-hashes --disable-pip -r requirements.txt
"$PYTHON" -m pip_audit --strict --require-hashes --disable-pip -r requirements-dev.txt

if [ "${CI_SKIP_IMAGE:-0}" = "1" ]; then
  step "Image build and scan skipped (CI_SKIP_IMAGE=1)"
else
  step "Build image"
  docker build -q -t "$APP_IMAGE" . >/dev/null
  echo "$APP_IMAGE built"

  step "Scan image (Trivy: HIGH and CRITICAL with a fix available)"
  # MSYS_NO_PATHCONV stops Git Bash rewriting the socket path on Windows.
  MSYS_NO_PATHCONV=1 docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v zoiko-sports-trivy-cache:/root/.cache/ \
    "$TRIVY_IMAGE" image --quiet --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$APP_IMAGE"
fi

step "CI passed in $(($(date +%s) - started))s"
