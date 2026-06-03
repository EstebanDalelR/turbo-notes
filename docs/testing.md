# Testing

The app has three test layers. All three run without external services — the
e2e layer mocks every `/api/` call in-process, so no Django server is required.

| Layer | Tooling | Location | Run |
| --- | --- | --- | --- |
| Backend | Django test runner (`APITestCase`) | `backend/*/tests.py` | `python manage.py test` |
| Frontend units | Vitest + jsdom | `frontend/src/**/*.test.ts` | `npm test` |
| E2E | Playwright (Chromium) | `frontend/e2e/*.spec.ts` | `npm run e2e` |

## Backend

```bash
cd backend
python manage.py test          # all apps
python manage.py test notes    # one app
```

Covered: default-category seeding, soft-delete manager, note CRUD + autosave,
last-write-wins on `client_updated_at`, trash/restore, cross-user category and
attachment isolation, attachment upload metadata, public-note access control,
the register/login/logout/me auth flow, and the transcribe proxy
(503 unconfigured, 400 no audio, `auto` language omitted, 502 upstream
failures, happy-path Groq forwarding). External HTTP (`requests.post` to Groq)
is mocked — no network calls.

## Frontend units

```bash
cd frontend
npm test           # one-shot (vitest run)
npm run test:watch # watch mode
```

These cover the voice logic that's awkward to drive through a real browser:

- `src/voice/recorder.test.ts` — mic request, MIME-type selection, blob
  capture, track release, unsupported-browser guard (fake `MediaRecorder` /
  `getUserMedia`).
- `src/voice/transcribe.test.ts` — trimmed text, language forwarding, `auto`
  omission, `503 → null` server-unconfigured fallback, error rethrow (the axios
  client is mocked).
- `src/store/voice.test.ts` — store defaults, model-switch resetting
  `modelReady`, `localStorage` persistence.

Config lives in `vitest.config.ts` (kept separate from `vite.config.ts` so the
PWA plugin stays out of the test environment); setup in `src/test/setup.ts`.

## E2E

```bash
cd frontend
npx playwright install chromium   # one-time, downloads the browser
npm run e2e
npm run e2e -- --ui               # interactive runner
```

Playwright boots the Vite dev server (`webServer` in `playwright.config.ts`) and
drives Chromium. Every `/api/` request is fulfilled by an in-test stateful mock
(`e2e/mock.ts`), so runs are deterministic and need no backend.

Key configuration choices:

- **Service workers are blocked** (`serviceWorkers: 'block'`) so the PWA cache
  never shadows the route mocks.
- **A fake microphone** is supplied via Chromium flags
  (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`), so
  the dictation spec exercises real `MediaRecorder` recording end to end.
- The mock route is anchored to the origin path (`/api/...`), **not** a
  `**/api/**` glob — the glob would also match the app's own source modules
  served by Vite from `/src/api/...` and break the module graph.

Specs:

- `e2e/notes-flow.spec.ts` — login → dashboard, create + autosave, public toggle
  (asserts both the request payload and that the share UI appears without a
  reload), trash.
- `e2e/dictation.spec.ts` — record → mocked `/transcribe/` → text inserted in
  the editor; plus the offline-model UI states (not-downloaded, offline disables
  download, a seeded `modelReady` showing "ready ✓") — none of which fetch the
  multi-megabyte Whisper weights.

## CI notes

- Playwright artifacts (`test-results/`, `playwright-report/`) are gitignored.
- In CI, `playwright.config.ts` enables `retries: 1`, the `github` reporter, and
  `forbidOnly`. Install the browser with `npx playwright install --with-deps
  chromium` before `npm run e2e`.
