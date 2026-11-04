# Zoiko Sports — backend

Django REST API for sign-in, registration, email verification and password
reset, plus the Docker Compose stack for the whole application.

**Full documentation** — architecture, environment variables, authentication
workflows, theming and troubleshooting — is in [`../frontend/README.md`](../frontend/README.md).

## Quick reference

Run the complete application (from this folder):

```sh
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
docker compose up -d --build  # build and start → http://localhost:8080/login
docker compose ps             # status and health
docker compose logs -f backend
docker compose restart
docker compose stop
docker compose down           # add -v to also delete the database volume
```

Develop the API without Docker:

```sh
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 127.0.0.1:8000
.venv/Scripts/python manage.py test accounts
```
