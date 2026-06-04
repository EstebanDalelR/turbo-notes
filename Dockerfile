# syntax=docker/dockerfile:1

# ---- Stage 1: build the React PWA -----------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend

# Install deps for the build.
#   --ignore-scripts: the only meaningful install script here is sharp's (a
#     transitive dep of @huggingface/transformers, used only Node-side for image
#     processing). The browser bundle never touches it and building from source
#     needs a toolchain we don't ship. esbuild/rolldown binaries come via
#     optional platform deps (no script), so the build is unaffected.
#   `npm install` (not `npm ci`): the committed lock is generated on macOS and
#     omits the Linux-only transitive deps (@emnapi/*) that the Linux sharp
#     binaries require, which `npm ci` rejects as out-of-sync. `install`
#     reconciles them for this platform.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --ignore-scripts --no-audit --no-fund

# Build the production bundle (tsc -b && vite build -> frontend/dist).
COPY frontend/ ./
RUN npm run build


# ---- Stage 2: Django runtime ----------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=0 \
    # The built PWA (served at root by WhiteNoise) and persistent data paths.
    DJANGO_PWA_ROOT=/app/frontend_dist \
    DJANGO_DB_PATH=/data/db.sqlite3 \
    DJANGO_MEDIA_ROOT=/data/media \
    DJANGO_STATIC_ROOT=/app/backend/staticfiles

WORKDIR /app/backend

# Python deps (pillow ships manylinux wheels, so no compiler toolchain needed).
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code + the built frontend from stage 1.
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend_dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
