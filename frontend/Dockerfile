# Zoiko Sports web app — Vite build served by nginx, which also proxies /api to
# the backend so session and CSRF cookies are same-origin.

# --- Build -------------------------------------------------------------------
# Debian (glibc) base: the TypeScript 7 and Vite 8 toolchains ship native binaries.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Optional footer destinations, baked in at build time (unset links render as text).
ARG VITE_LINK_PRIVACY=
ARG VITE_LINK_TERMS=
ARG VITE_LINK_SECURITY=
ARG VITE_LINK_ACCESSIBILITY=
ARG VITE_LINK_HELP=
RUN npm run build

# --- Serve -------------------------------------------------------------------
# nginx mainline branch (nginx.org's general recommendation; in Nov 2026 the
# 1.30 stable image still shipped nginx with fixable HIGH/CRITICAL advisories).
# Packages are upgraded at build time so security fixes Alpine published after
# the base image was built are included (CI's image scan fails on any fixable
# HIGH or CRITICAL vulnerability); then back to the image's unprivileged user.
FROM nginxinc/nginx-unprivileged:1.31-alpine
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
