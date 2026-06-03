import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the axios client so no real request is made.
vi.mock('../api/client', () => ({ api: { post: vi.fn() } }))

import { api } from '../api/client'
import { transcribeOnline } from './transcribe'

const post = api.post as unknown as ReturnType<typeof vi.fn>

function blob() {
  return new Blob(['fake-audio'], { type: 'audio/webm' })
}

describe('transcribeOnline', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('returns the trimmed transcript text', async () => {
    post.mockResolvedValue({ data: { text: '  hello world  ' } })
    const text = await transcribeOnline(blob(), 'en')
    expect(text).toBe('hello world')
  })

  it('forwards the language hint to the server', async () => {
    post.mockResolvedValue({ data: { text: 'hi' } })
    await transcribeOnline(blob(), 'es')
    const form = post.mock.calls[0][1] as FormData
    expect(form.get('language')).toBe('es')
    expect(form.get('audio')).toBeInstanceOf(Blob)
  })

  it("omits the language when set to 'auto'", async () => {
    post.mockResolvedValue({ data: { text: 'hi' } })
    await transcribeOnline(blob(), 'auto')
    const form = post.mock.calls[0][1] as FormData
    expect(form.get('language')).toBeNull()
  })

  it('returns null when the server reports it is unconfigured (503)', async () => {
    post.mockRejectedValue({ response: { status: 503 } })
    const text = await transcribeOnline(blob(), 'en')
    expect(text).toBeNull()
  })

  it('rethrows on other errors so the caller can show a failure', async () => {
    post.mockRejectedValue({ response: { status: 500 } })
    await expect(transcribeOnline(blob(), 'en')).rejects.toBeTruthy()
  })

  it('treats a missing text field as an empty transcript', async () => {
    post.mockResolvedValue({ data: {} })
    expect(await transcribeOnline(blob(), 'en')).toBe('')
  })
})
