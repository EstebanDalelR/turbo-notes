# Turbo Notes

A sophisticated, offline-capable markdown notes app with a sepia, old-typewriter aesthetic.
React PWA frontend + Django REST Framework backend (SQLite).

## Features

- Markdown notes with a plain editor + preview toggle
- **Voice dictation** — speak notes; online uses Groq Whisper, offline uses an on-device model ([docs](docs/voice.md))
- Colored categories (4 defaults seeded per user: Grocery list, Money ideas, Random thoughts, Projects); add/recolor/delete your own
- **No save button** — debounced autosave (~800 ms) with last-write-wins conflict resolution
- File attachments (images, video, any file); images can be embedded in markdown
- Public, read-only shareable note pages at `/n/<uuid>` (private by default)
- Export a note as `.md` or a standalone styled `.html`
- Soft-delete **Trash** with restore / permanent delete
- Light/dark mode with persistent toggle
- **Offline mode** (installable PWA): edit/create offline, changes queue in an IndexedDB
  outbox and sync on reconnect; a banner shows offline/pending state

## Layout

```
backend/    Django project (config/) + accounts/ + notes/ apps, SQLite, media/
frontend/   Vite + React + TypeScript PWA (TanStack Query, Zustand, Tailwind)
```

## Quick start

**One-time setup** (creates the backend venv + installs deps):

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python manage.py migrate && cd ..
cd frontend && npm install && cd ..
```

**Run both servers with a single command** from the repo root:

```bash
python3 dev.py
```

This spawns the Django backend (`:8000`) and the Vite frontend (`:5173`) together
and merges their output into one color-coded, source-tagged stream. Open
http://localhost:5173 and Ctrl-C stops both.

All flags:

| Flag | Default | Effect |
| --- | --- | --- |
| `--level <log\|info\|warn\|error>` | `log` | Minimum severity to display (`log` = everything; `warn` shows only `WARN`/`ERROR`) |
| `--no-color` | off | Disable ANSI colors — plain output, e.g. when piping to a file |
| `--backend-port <port>` | `8000` | Port for the Django backend |

See [docs/development.md](docs/development.md) for details and how to run the two
servers separately.

## Backend — run separately

(Prefer `python3 dev.py` above; this is for running the backend on its own.)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser   # optional, for /admin
.venv/bin/python manage.py runserver 8000
```

Run tests: `.venv/bin/python manage.py test`

### Key endpoints
- `POST /api/auth/register|login|logout/`, `GET /api/auth/me/`, `GET /api/auth/csrf/`
- `GET/POST/PATCH/DELETE /api/notes/` (+ `?trashed=true`, `POST {id}/restore/`, `DELETE {id}/purge/`)
- `GET/POST/PATCH/DELETE /api/categories/`
- `POST/DELETE /api/attachments/` (multipart upload)
- `GET /api/public/notes/<uuid>/` (anonymous, public notes only)

## Frontend — run separately

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api and /media to :8000)
```

Build / preview (service worker only runs on a build): `npm run build && npm run preview`

## How offline sync works

- Reads: TanStack Query cache is persisted to `localStorage`; the service worker
  (`vite-plugin-pwa` / Workbox) caches API GETs and viewed `/media/` files.
- Writes: when offline (or on network error), mutations are appended to an ordered
  IndexedDB outbox (`src/offline/outbox.ts`). On the `online` event the outbox is
  replayed in order (`src/offline/sync.ts`); notes created offline use a temporary id
  that is remapped to the real server id during flush. The server resolves any edit
  conflicts via last-write-wins on `client_updated_at`.

## Testing

Three layers, all runnable without external services (the e2e layer mocks the API):

```bash
cd backend  && python manage.py test          # Django API tests
cd frontend && npm test                       # Vitest unit tests (voice logic)
cd frontend && npx playwright install chromium && npm run e2e   # Playwright e2e
```

See [docs/testing.md](docs/testing.md) for what each layer covers and how the
e2e mock / fake-microphone setup works.

## Notes

- Dev uses session auth + CSRF over the Vite proxy (same origin), so cookies just work.
- Settings read from env vars (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `FRONTEND_ORIGINS`, …)
  with dev-friendly defaults. Set a real secret key and `DJANGO_DEBUG=0` for production.
- Set `GROQ_API_KEY` to enable online voice dictation (Groq Whisper); without it,
  dictation falls back to the on-device model. See [docs/voice.md](docs/voice.md).

## Documentation

| Doc | What's in it |
| --- | --- |
| [docs/development.md](docs/development.md) | Local setup, the `dev.py` one-command flow, tests & linting, project layout |
| [docs/architecture.md](docs/architecture.md) | How the offline-first pieces fit together end to end |
| [docs/api.md](docs/api.md) | REST API reference for the endpoints under `/api/` |
| [docs/data-model.md](docs/data-model.md) | The three tables (Note / Category / Attachment) and their fields |
| [docs/offline-sync.md](docs/offline-sync.md) | The offline outbox + reconnect sync model in depth |
| [docs/voice.md](docs/voice.md) | Voice dictation: online Groq Whisper + on-device offline model |
| [docs/testing.md](docs/testing.md) | The three test layers (Django, Vitest, Playwright) and how to run them |
