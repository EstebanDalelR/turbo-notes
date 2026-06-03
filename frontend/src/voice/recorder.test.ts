import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Recorder, isRecordingSupported } from './recorder'

// --- Minimal fakes: jsdom ships neither MediaRecorder nor getUserMedia. ---

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((t: string) => t === 'audio/webm')
  state = 'inactive'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(public stream: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? ''
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    // Emit one chunk, then fire stop — mirrors the real event order.
    this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

const trackStop = vi.fn()
const fakeStream = { getTracks: () => [{ stop: trackStop }] }
const getUserMedia = vi.fn(async () => fakeStream)

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder as unknown as typeof MediaRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  getUserMedia.mockClear()
  trackStop.mockClear()
  FakeMediaRecorder.isTypeSupported.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isRecordingSupported', () => {
  it('is true when getUserMedia and MediaRecorder exist', () => {
    expect(isRecordingSupported()).toBe(true)
  })

  it('is false when MediaRecorder is missing', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(isRecordingSupported()).toBe(false)
  })
})

describe('Recorder', () => {
  it('requests the mic and picks the first supported mime type', async () => {
    const rec = new Recorder()
    await rec.start()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    // audio/webm is the first candidate our fake reports as supported.
    expect(FakeMediaRecorder.isTypeSupported).toHaveBeenCalledWith('audio/webm')
  })

  it('stop() resolves with the captured audio blob', async () => {
    const rec = new Recorder()
    await rec.start()
    const blob = await rec.stop()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('stop() releases the microphone tracks', async () => {
    const rec = new Recorder()
    await rec.start()
    await rec.stop()
    expect(trackStop).toHaveBeenCalled()
  })

  it('stop() before start() rejects', async () => {
    const rec = new Recorder()
    await expect(rec.stop()).rejects.toThrow('Not recording')
  })

  it('cancel() stops the tracks without producing a transcript', async () => {
    const rec = new Recorder()
    await rec.start()
    rec.cancel()
    expect(trackStop).toHaveBeenCalled()
  })
})
