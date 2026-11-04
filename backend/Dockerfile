# Zoiko Sports API — Django + DRF served by gunicorn.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SQLITE_PATH=/app/data/db.sqlite3

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app

# Dependencies first so code changes don't invalidate this layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Static files for the Django admin (served by WhiteNoise). The throwaway key only
# satisfies settings at build time; the runtime key comes from the entrypoint.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
    && chmod +x docker-entrypoint.sh \
    && DJANGO_SECRET_KEY=build-only DJANGO_DEBUG=false python manage.py collectstatic --noinput -v 0 \
    && mkdir -p /app/data \
    && chown -R app:app /app/data

USER app
VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/auth/config/', timeout=4).status == 200 else 1)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-", "--error-logfile", "-"]
