import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** transformers.js model ids for the on-device (offline) path. */
export type LocalModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-base'

export const LOCAL_MODELS: { id: LocalModel; label: string; size: string }[] = [
  { id: 'Xenova/whisper-tiny', label: 'Tiny — fast', size: '~40 MB' },
  { id: 'Xenova/whisper-base', label: 'Base — better', size: '~80 MB' },
]

/** Languages offered in the dictation popover. 'auto' lets Whisper detect. */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
]

interface VoiceState {
  language: string
  model: LocalModel
  /** True once the chosen model has been downloaded + cached for offline use. */
  modelReady: boolean
  setLanguage: (code: string) => void
  setModel: (model: LocalModel) => void
  setModelReady: (ready: boolean) => void
}

export const useVoice = create<VoiceState>()(
  persist(
    (set) => ({
      language: 'auto',
      model: 'Xenova/whisper-tiny',
      modelReady: false,
      setLanguage: (language) => set({ language }),
      // Switching models invalidates the "ready" flag — the new one isn't cached yet.
      setModel: (model) => set({ model, modelReady: false }),
      setModelReady: (modelReady) => set({ modelReady }),
    }),
    { name: 'turbo-voice' },
  ),
)
