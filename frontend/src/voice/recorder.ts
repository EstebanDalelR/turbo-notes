/** Thin MediaRecorder wrapper: start(), then stop() resolves to the audio Blob.
 *
 * Picks a mime type the browser actually supports — Chrome/Firefox favour
 * audio/webm, Safari produces audio/mp4. Whisper (Groq and on-device) accepts
 * both. getUserMedia + MediaRecorder are available in Chrome, Firefox, Safari,
 * and their mobile counterparts.
 */

function pickMimeType(): string {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg']
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type
    }
  }
  return ''
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

export class Recorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start()
  }

  /** Stop recording and release the mic; resolves with the captured audio. */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder
      if (!rec) {
        reject(new Error('Not recording'))
        return
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' })
        this.release()
        resolve(blob)
      }
      rec.stop()
    })
  }

  /** Abort without producing a transcript (e.g. user cancels). */
  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null
      this.recorder.stop()
    }
    this.release()
  }

  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.recorder = null
  }
}
