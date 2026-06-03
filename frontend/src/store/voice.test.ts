import { beforeEach, describe, expect, it } from 'vitest'
import { LANGUAGES, LOCAL_MODELS, useVoice } from './voice'

describe('voice store', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset to defaults between tests (the store is a module singleton).
    useVoice.setState({ language: 'auto', model: 'Xenova/whisper-tiny', modelReady: false })
  })

  it('starts with sane defaults', () => {
    const s = useVoice.getState()
    expect(s.language).toBe('auto')
    expect(s.model).toBe('Xenova/whisper-tiny')
    expect(s.modelReady).toBe(false)
  })

  it('setLanguage updates the language', () => {
    useVoice.getState().setLanguage('es')
    expect(useVoice.getState().language).toBe('es')
  })

  it('switching the model invalidates the ready flag', () => {
    useVoice.getState().setModelReady(true)
    expect(useVoice.getState().modelReady).toBe(true)
    useVoice.getState().setModel('Xenova/whisper-base')
    expect(useVoice.getState().model).toBe('Xenova/whisper-base')
    // The new model isn't cached yet, so ready must reset to false.
    expect(useVoice.getState().modelReady).toBe(false)
  })

  it('persists under the turbo-voice key', () => {
    useVoice.getState().setLanguage('fr')
    expect(localStorage.getItem('turbo-voice')).toContain('fr')
  })

  it('exposes auto-detect plus offline model options', () => {
    expect(LANGUAGES[0].code).toBe('auto')
    expect(LOCAL_MODELS.map((m) => m.id)).toEqual([
      'Xenova/whisper-tiny',
      'Xenova/whisper-base',
    ])
  })
})
