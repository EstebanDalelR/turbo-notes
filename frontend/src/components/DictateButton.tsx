import { useRef, useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { LANGUAGES, LOCAL_MODELS, useVoice } from '../store/voice'
import { Recorder, isRecordingSupported } from '../voice/recorder'
import { ensureLocalModel, transcribeLocal, transcribeOnline } from '../voice/transcribe'

type Status = 'idle' | 'recording' | 'transcribing' | 'downloading' | 'error'

/** Mic button + settings popover. Calls `onInsert` with the recognized text. */
export function DictateButton({ onInsert }: { onInsert: (text: string) => void }) {
  const online = useOnline()
  const { language, model, modelReady, setLanguage, setModel, setModelReady } = useVoice()
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const recorder = useRef<Recorder | null>(null)

  const supported = isRecordingSupported()

  const startRecording = async () => {
    setMessage('')
    // Offline with no cached model: nothing can transcribe — guide the user.
    if (!online && !modelReady) {
      setMessage('Offline needs the on-device model. Open settings to download it while online.')
      setOpen(true)
      return
    }
    try {
      recorder.current = new Recorder()
      await recorder.current.start()
      setStatus('recording')
    } catch {
      setStatus('error')
      setMessage('Could not access the microphone.')
    }
  }

  const stopAndTranscribe = async () => {
    if (!recorder.current) return
    setStatus('transcribing')
    try {
      const blob = await recorder.current.stop()
      let text: string | null = null
      if (online) {
        text = await transcribeOnline(blob, language) // null if server unconfigured
      }
      if (text === null) {
        if (!modelReady) {
          setStatus('idle')
          setMessage('No server transcription. Download the on-device model in settings.')
          setOpen(true)
          return
        }
        text = await transcribeLocal(blob, language, model)
      }
      if (text) onInsert(text)
      setStatus('idle')
    } catch {
      setStatus('error')
      setMessage('Transcription failed.')
    }
  }

  const downloadModel = async () => {
    setStatus('downloading')
    setProgress(0)
    setMessage('')
    try {
      await ensureLocalModel(model, (p) => setProgress(p.progress))
      setModelReady(true)
      setStatus('idle')
      setMessage('Offline model ready.')
    } catch {
      setStatus('error')
      setMessage('Model download failed.')
    }
  }

  if (!supported) return null

  const recording = status === 'recording'

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={recording ? stopAndTranscribe : startRecording}
        disabled={status === 'transcribing' || status === 'downloading'}
        aria-label={recording ? 'Stop dictation' : 'Dictate'}
        className={`rounded-l border border-sepia-400/60 px-2 py-1 text-sm hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60 disabled:opacity-60 ${
          recording ? 'bg-red-700 text-white animate-pulse' : ''
        }`}
      >
        {recording ? '■ Stop' : status === 'transcribing' ? 'Transcribing…' : '🎤 Dictate'}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Dictation settings"
        className="rounded-r border border-l-0 border-sepia-400/60 px-1.5 py-1 text-sm hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60"
      >
        ▾
      </button>

      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 w-72 rounded-lg border border-sepia-300 dark:border-sepia-700 bg-sepia-50 dark:bg-sepia-900 shadow-paper p-3 text-sm space-y-3">
          <div>
            <label className="block text-xs text-sepia-500 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-2 py-1"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-sepia-500 mb-1">
              Offline model {modelReady ? '· ready ✓' : '· not downloaded'}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as typeof model)}
              className="w-full rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-2 py-1"
            >
              {LOCAL_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label} ({m.size})</option>
              ))}
            </select>
          </div>

          {status === 'downloading' ? (
            <div>
              <div className="h-2 rounded bg-sepia-200 dark:bg-sepia-800 overflow-hidden">
                <div className="h-full bg-sepia-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="text-xs text-sepia-500 mt-1">Downloading… {Math.round(progress * 100)}%</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={downloadModel}
              disabled={!online}
              className="w-full rounded bg-sepia-600 text-sepia-50 py-1.5 hover:bg-sepia-700 disabled:opacity-50"
            >
              {modelReady ? 'Re-download offline model' : 'Download for offline use'}
            </button>
          )}
          {!online && !modelReady && (
            <p className="text-xs text-sepia-500">Connect to the internet once to download the model.</p>
          )}
        </div>
      )}

      {message && <span className="ml-2 text-xs text-sepia-500 max-w-[16rem]">{message}</span>}
    </div>
  )
}
