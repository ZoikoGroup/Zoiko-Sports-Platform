# Zoiko Sports — backend

Django REST API for sign-in, registration, email verification and password
reset, plus the Docker Compose files for the whole application.

**Full documentation** — architecture, setup, environment variables, API,
authentication workflows and troubleshooting — is in the
[repository README](../README.md).

## Quick reference

Run from this folder:

```sh
cp .env.example .env          # PowerShell: Copy-Item .env.example .env

# Full stack (nginx + API) → http://localhost:8080/login
docker compose up -d --build

# Development: API only, for `npm run dev` in ../frontend → http://localhost:5173/login
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend

docker compose ps                  # status and health
docker compose logs -f backend     # API log (verification / reset emails appear here)
docker compose restart
docker compose down                # add -v to also delete the database volume
```

API without Docker:

```sh
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 127.0.0.1:8000
.venv/Scripts/python manage.py test accounts
```
