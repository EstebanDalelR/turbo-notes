#!/usr/bin/env bash
# Prepare the persistent volume and Django runtime, then hand off to the CMD
# (gunicorn). Runs on every container boot.
set -euo pipefail

# Ensure the data volume dirs exist (mounted at /data by Kamal).
mkdir -p "$(dirname "${DJANGO_DB_PATH:-/data/db.sqlite3}")" "${DJANGO_MEDIA_ROOT:-/data/media}"

# Apply DB migrations and gather admin/DRF static assets into STATIC_ROOT.
python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
