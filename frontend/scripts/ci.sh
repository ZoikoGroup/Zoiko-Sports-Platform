#!/usr/bin/env bash
# Zoiko Sports frontend CI pipeline. Every step must pass; the first failure stops it.
#
#   lint → type check + production build → dependency audit
#   → image build → image vulnerability scan
#
# Run from anywhere (Git Bash on Windows, or any Linux/macOS shell), after
# `npm ci` (or `npm install`) in frontend/:
#   frontend/scripts/ci.sh
#
# Environment:
#   CI_SKIP_IMAGE=1  skip the image build and scan (no Docker daemon available)
set -euo pipefail

cd "$(dirname "$0")/.."

# Pinned by digest (aquasec/trivy:0.69.1), the same scanner as backend/scripts/ci.sh.
TRIVY_IMAGE="aquasec/trivy@sha256:1c78ed1ef824ab8bb05b04359d186e4c1229d0b3e67005faacb54a7d71974f73"
APP_IMAGE="zoiko-sports-frontend:ci"

started=$(date +%s)
step() { printf '\n==> %s\n' "$*"; }

step "Node $(node --version), npm $(npm --version)"

step "Lint (oxlint)"
npm run --silent lint

step "Type check and production build"
npm run --silent build

step "Dependency audit (npm audit: fails on high or critical)"
npm audit --audit-level=high

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

step "Frontend CI passed in $(($(date +%s) - started))s"
