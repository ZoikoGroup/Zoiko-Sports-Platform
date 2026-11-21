# Zoiko Sports — backend

Django 5.2 + DRF REST API on PostgreSQL 16 (sign-in, registration, email
verification, password reset, health probes), plus the Docker Compose files for
the whole application.

**Full documentation** — architecture, setup, environment variables, API,
authentication workflows, testing and troubleshooting — is in the
[repository README](../README.md).

## Quick reference

Run from this folder. First time: copy `.env.example` to `.env` and set
`POSTGRES_PASSWORD` (required).

```sh
cp .env.example .env          # PowerShell: Copy-Item .env.example .env

# Full stack (nginx + API + PostgreSQL) → http://localhost:8080/login
docker compose up -d --build

# Development: API + database, for `npm run dev` in ../frontend → http://localhost:5173/login
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend

docker compose ps                  # status and health (db, backend, frontend)
docker compose logs -f backend     # API log, JSON (verification / reset emails appear here)
docker compose down                # add -v to also delete the database volume
```

API on the host (Python 3.12; database from the dev override on 127.0.0.1:5433):

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
python -m uv venv .venv --python 3.12
python -m uv pip sync requirements-dev.txt --python .venv/Scripts/python.exe   # macOS/Linux: .venv/bin/python
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 127.0.0.1:8000
.venv/Scripts/python manage.py test
```

CI pipeline (lint, types, tests on a throwaway PostgreSQL 16, audits, image scan):

```sh
scripts/ci.sh
```
