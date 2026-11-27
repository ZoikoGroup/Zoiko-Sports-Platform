# Zoiko Sports API — Django + DRF served by gunicorn, backed by PostgreSQL 16.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_READ_DOTENV=false

WORKDIR /app

# System packages are upgraded at build time so security fixes Debian published
# after the base image was built are included (CI's image scan fails on any
# fixable HIGH or CRITICAL vulnerability, e.g. CVE-2025-6020 in libpam, Nov 2026).
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app

# Dependencies first so code changes don't invalidate this layer. Every package
# is verified against the hashes in the lock file.
COPY requirements.txt .
RUN pip install --require-hashes -r requirements.txt

COPY . .

# Static files for the Django admin (served by WhiteNoise). The throwaway key only
# satisfies settings at build time; the runtime key comes from the entrypoint.
# No database is contacted during the build.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
    && chmod +x docker-entrypoint.sh \
    && DJANGO_SECRET_KEY=build-only DJANGO_DEBUG=false python manage.py collectstatic --noinput -v 0 \
    && mkdir -p /app/data \
    && chown -R app:app /app/data

USER app
# Generated secret key and the shared rate-limit cache (the database has its own service).
VOLUME ["/app/data"]
EXPOSE 8000

# Ready = the database answers and every migration is applied.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/ready/', timeout=4).status == 200 else 1)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--config", "gunicorn.conf.py"]
