# Voice dictation

Dictate note content with your voice, from inside the editor. There's a
**🎤 Dictate** button in the editor toolbar (with a **▾** settings popover for
language and the offline model). Recognized text is inserted at the cursor and
flows through the normal autosave path.

## The two paths

Voice-to-text has no single API that works in every browser *and* offline, so
Turbo uses two mechanisms and picks per situation:

| Situation | Engine | Notes |
| --- | --- | --- |
| **Online** | **Groq Whisper** (`whisper-large-v3`) | Audio is recorded in the browser and sent to our Django endpoint, which calls Groq server-side. Best quality, works in every browser. |
| **Offline** | **On-device Whisper** (`transformers.js`, WASM) | Runs entirely in the browser. Requires a one-time model download (see below). |

Recording itself uses `MediaRecorder` + `getUserMedia`, which work in Chrome,
Firefox, Safari, and their mobile versions. (The browser `SpeechRecognition`
API is deliberately **not** used: Firefox lacks it, and in Chrome it streams
audio to Google's servers, so it isn't truly offline.)

### Why not just rely on the phone keyboard mic?

On mobile, the OS keyboard's dictation already works offline in any text field —
and users can still use it. But it's mobile-only, can't be triggered from code,
and doesn't exist on desktop. The two-path approach above covers desktop and
mobile, online and offline, uniformly.

## The offline caveat

On-device Whisper can only run offline **after** the model has been downloaded
once while online. `transformers.js` fetches the model weights (from Hugging
Face) and the ONNX runtime (~24 MB wasm, bundled with the app) on first use and
caches them (Cache Storage + the service worker), so they survive offline
afterwards.

Because that's a large download, it's **opt-in**: open the **▾** popover and
click **"Download for offline use."** Until then, online dictation (Groq) still
works with no download. Pick the model first:

| Model | Size | Trade-off |
| --- | --- | --- |
| `whisper-tiny` (default) | ~40 MB | Fast, lower accuracy |
| `whisper-base` | ~80 MB | Slower on CPU, better accuracy |

Language can be set to **Auto-detect** (default) or pinned to a specific
language; the hint is passed to both Groq and the on-device model.

## Backend setup (online path)

Set an API key so `POST /api/transcribe/` can reach Groq:

```bash
export GROQ_API_KEY=gsk_...          # from https://console.groq.com
export GROQ_MODEL=whisper-large-v3   # optional; this is the default
```

Without `GROQ_API_KEY` the endpoint returns `503`, and the frontend falls back
to the on-device model. The key is read server-side only and is never exposed to
the browser.

### Endpoint

`POST /api/transcribe/` (authenticated, multipart)

- `audio` — the recorded clip (required)
- `language` — ISO-639-1 hint like `en` / `es`, or omit / `auto` to detect

Returns `{ "text": "..." }`.
