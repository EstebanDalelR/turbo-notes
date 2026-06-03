import { api } from '../api/client'
import type { LocalModel } from '../store/voice'

/** Progress while a model downloads (0–1), or null once running/complete. */
export type ModelProgress = { file: string; progress: number }

/**
 * Online path: ship the audio to our Django endpoint, which calls Groq Whisper.
 * Returns null if the server path isn't configured (no GROQ_API_KEY) so callers
 * can fall back to the on-device model.
 */
export async function transcribeOnline(blob: Blob, language: string): Promise<string | null> {
  const form = new FormData()
  form.append('audio', blob, 'audio.webm')
  if (language && language !== 'auto') form.append('language', language)
  try {
    const { data } = await api.post('/transcribe/', form)
    return (data.text ?? '').trim()
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 503) return null // server transcription not configured
    throw err
  }
}

// transformers.js is heavy (~MBs) and pulls ONNX runtime, so it's dynamically
// imported only when the on-device path is actually used.
let pipelinePromise: Promise<unknown> | null = null
let loadedModel: LocalModel | null = null

async function getTransformers() {
  const mod = await import('@huggingface/transformers')
  // Cache model files in the browser Cache Storage so they survive offline; the
  // first fetch must happen online (see ensureLocalModel).
  mod.env.allowLocalModels = false
  mod.env.useBrowserCache = true
  return mod
}

/**
 * Ensure the chosen on-device model is downloaded and cached. Safe to call
 * repeatedly; the first call (must be online) pulls ~40–80 MB, later calls are
 * instant. `onProgress` reports download progress for a UI bar.
 */
export async function ensureLocalModel(
  model: LocalModel,
  onProgress?: (p: ModelProgress) => void,
): Promise<void> {
  if (loadedModel === model && pipelinePromise) {
    await pipelinePromise
    return
  }
  const { pipeline } = await getTransformers()
  loadedModel = model
  pipelinePromise = pipeline('automatic-speech-recognition', model, {
    progress_callback: (e: { status?: string; file?: string; progress?: number }) => {
      if (e.status === 'progress' && onProgress) {
        onProgress({ file: e.file ?? '', progress: (e.progress ?? 0) / 100 })
      }
    },
  })
  await pipelinePromise
}

/** On-device transcription via the cached Whisper model. */
export async function transcribeLocal(
  blob: Blob,
  language: string,
  model: LocalModel,
): Promise<string> {
  await ensureLocalModel(model)
  const transcriber = (await pipelinePromise) as (
    input: string,
    opts: Record<string, unknown>,
  ) => Promise<{ text: string }>

  const url = URL.createObjectURL(blob)
  try {
    const opts: Record<string, unknown> = { task: 'transcribe' }
    if (language && language !== 'auto') opts.language = language
    const out = await transcriber(url, opts)
    return (out.text ?? '').trim()
  } finally {
    URL.revokeObjectURL(url)
  }
}
