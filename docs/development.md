# Development

How to run Turbo Notes locally and hack on it.

## Prerequisites

- Python 3.12+
- Node 20+ / npm
- No external services — the dev stack is SQLite + the Vite dev server.

## One-command dev (recommended)

From the repo root:

```bash
python3 dev.py
```

This launches **both** servers and merges their output into one color-coded,
level-tagged stream — every line is prefixed with its source (`backend` /
`frontend`) and classified `LOG` / `INFO` / `WARN` / `ERROR`. Ctrl-C stops both.

```
12:00:01  backend INFO  Watching for file changes with StatReloader
12:00:02 frontend INFO    VITE v8.0.12  ready in 312 ms
12:00:05  backend INFO  "GET /api/notes/ HTTP/1.1" 200 1234
12:00:06  backend WARN  "GET /api/auth/me/ HTTP/1.1" 403 58
```

Options:

| Flag | Effect |
| --- | --- |
| `--level warn` | only show `WARN` and `ERROR` lines (also `info`, `error`) |
| `--no-color` | plain output, e.g. when piping to a file |
| `--backend-port 8001` | change the Django port |

`dev.py` prefers `backend/.venv/bin/python` if present and falls back to the
current interpreter; it warns if `frontend/node_modules` is missing. **First
run** still needs the one-time setup below so the venv and deps exist.

> Severity is inferred from log text and HTTP status (5xx → `ERROR`, 4xx →
> `WARN`, 2xx/3xx → `INFO`). The expected `403` on `/api/auth/me/` while logged
> out shows as `WARN`, not `ERROR`.

## First-time setup

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser   # optional, for /admin
```

### Frontend

```bash
cd frontend
npm install
```

After this, `python3 dev.py` from the root runs everything.

## Running the servers separately

If you'd rather have two terminals:

```bash
# terminal 1
cd backend && .venv/bin/python manage.py runserver 8000

# terminal 2
cd frontend && npm run dev      # http://localhost:5173
```

The Vite dev server proxies `/api` and `/media` to `:8000`, so the app is
same-origin and session/CSRF cookies work without CORS config.

## Tests & linting

```bash
cd backend && .venv/bin/python manage.py test     # Django tests
cd frontend && npm test                            # Vitest unit tests
cd frontend && npm run e2e                          # Playwright e2e (mocked API)
cd frontend && npm run lint                        # ESLint
cd frontend && npm run build                       # type-check (tsc -b) + prod build
```

See [testing.md](testing.md) for what each layer covers.

## Project layout

```
backend/
  config/        Django project (settings, urls, wsgi/asgi)
  accounts/      auth views, CSRF, default-category signal
  notes/         Note/Category/Attachment models, viewsets, serializers
  media/         user uploads (gitignored)
frontend/
  src/
    api/         TanStack Query hooks + axios client (online/offline routing)
    offline/     IndexedDB outbox + reconnect sync
    routes/      pages (Dashboard, Editor, Trash, Login, PublicNote, …)
    components/   shell, banner, markdown, pickers
    store/       Zustand (theme)
    hooks/       useOnline
dev.py           run both servers with merged, leveled logs
docs/            this documentation
```

## How to extend it

- **A new mutation that must work offline?** Add the op kind to `OutboxOp` in
  [`outbox.ts`](../frontend/src/offline/outbox.ts), handle it in `applyOp`
  ([`sync.ts`](../frontend/src/offline/sync.ts)), and have the mutation hook in
  [`api/notes.ts`](../frontend/src/api/notes.ts) branch on `isOffline()` to
  `enqueue` instead of calling the API. Follow the existing `note-update` as a
  template. See [offline-sync.md](./offline-sync.md).
- **A new API resource?** Register a ViewSet on the DRF router in
  [`notes/urls.py`](../backend/notes/urls.py); the queryset must be scoped to
  `request.user`.

See [architecture.md](./architecture.md) for how the pieces fit together.
