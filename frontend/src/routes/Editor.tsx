import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCategories } from '../api/categories'
import {
  useDeleteAttachment,
  useDeleteNote,
  useNote,
  useUpdateNote,
  useUploadAttachment,
} from '../api/notes'
import { Markdown } from '../components/Markdown'
import { exportHtml, exportMarkdown } from '../lib/export'
import { useOnline } from '../hooks/useOnline'
import type { SaveStatus } from '../lib/types'

const AUTOSAVE_MS = 800

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const online = useOnline()
  const noteId: number | string = id && /^\d+$/.test(id) ? Number(id) : (id ?? '')

  const { data: note, isLoading } = useNote(noteId)
  const { data: categories = [] } = useCategories()
  const update = useUpdateNote()
  const del = useDeleteNote()
  const upload = useUploadAttachment()
  const removeAttachment = useDeleteAttachment()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const previewRef = useRef<HTMLDivElement>(null)
  const hydrated = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate local state once when the note arrives.
  useEffect(() => {
    if (note && !hydrated.current) {
      setTitle(note.title)
      setContent(note.content)
      hydrated.current = true
    }
  }, [note])

  const queueSave = (data: { title?: string; content?: string; category?: number | null; is_public?: boolean }) => {
    if (timer.current) clearTimeout(timer.current)
    setStatus(online ? 'saving' : 'offline')
    timer.current = setTimeout(async () => {
      try {
        await update.mutateAsync({ id: noteId, data })
        setStatus(navigator.onLine ? 'saved' : 'offline')
      } catch {
        setStatus('error')
      }
    }, AUTOSAVE_MS)
  }

  // Flush a pending save when leaving.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (isLoading && !note) return <p className="p-6 text-sepia-500">Loading…</p>
  if (!note) return <p className="p-6 text-sepia-500">Note not found.</p>

  const onTitle = (v: string) => { setTitle(v); queueSave({ title: v }) }
  const onContent = (v: string) => { setContent(v); queueSave({ content: v }) }
  const onCategory = (v: string) => {
    const category = v === '' ? null : Number(v)
    queueSave({ category })
  }
  const onTogglePublic = () => queueSave({ is_public: !note.is_public })

  const publicUrl = `${window.location.origin}/n/${note.public_id}`

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      await upload.mutateAsync({ noteId, file })
      // Insert markdown for images so they render inline.
      if (file.type.startsWith('image/')) {
        onContent(`${content}\n\n![${file.name}](${file.name})\n`)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <button onClick={() => navigate('/')} className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">← Back</button>
        <select
          defaultValue={note.category ?? ''}
          onChange={(e) => onCategory(e.target.value)}
          className="rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-2 py-1"
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="inline-flex rounded border border-sepia-400/60 overflow-hidden">
          <button onClick={() => setMode('write')} className={`px-2 py-1 ${mode === 'write' ? 'bg-sepia-600 text-sepia-50' : ''}`}>Write</button>
          <button onClick={() => setMode('preview')} className={`px-2 py-1 ${mode === 'preview' ? 'bg-sepia-600 text-sepia-50' : ''}`}>Preview</button>
        </div>

        <span className="ml-auto text-sepia-500">{statusLabel(status)}</span>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Untitled"
        className="w-full font-display text-3xl bg-transparent outline-none mb-3 placeholder-sepia-400"
      />

      {/* Body */}
      {mode === 'write' ? (
        <textarea
          value={content}
          onChange={(e) => onContent(e.target.value)}
          placeholder="Write in markdown…"
          className="w-full min-h-[50vh] bg-transparent outline-none resize-y leading-relaxed"
        />
      ) : (
        <div className="min-h-[50vh]">
          <Markdown>{content}</Markdown>
        </div>
      )}

      {/* Always-rendered hidden copy so HTML export works without opening Preview. */}
      <div ref={previewRef} className="hidden" aria-hidden>
        <Markdown>{content}</Markdown>
      </div>

      {/* Attachments */}
      <div className="mt-6 border-t border-sepia-300/60 dark:border-sepia-700/60 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display">Attachments</h3>
          <label className="text-sm rounded border border-sepia-400/60 px-2 py-1 cursor-pointer hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">
            + Add file
            <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
        {note.attachments.length === 0 ? (
          <p className="text-sm text-sepia-500 italic">No attachments.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {note.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <a href={a.url} target="_blank" rel="noreferrer" className="underline truncate">{a.original_name || 'file'}</a>
                <button onClick={() => removeAttachment.mutate(a.id)} className="text-red-700 dark:text-red-400 text-xs">remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sharing + export + delete */}
      <div className="mt-6 border-t border-sepia-300/60 dark:border-sepia-700/60 pt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={note.is_public} onChange={onTogglePublic} />
          Public
        </label>
        {note.is_public && (
          <button
            onClick={() => navigator.clipboard.writeText(publicUrl)}
            className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60"
          >
            Copy link
          </button>
        )}
        <span className="ml-auto flex gap-2">
          <button onClick={() => exportMarkdown({ title, content })} className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">Export .md</button>
          <button
            onClick={() => exportHtml({ title, content }, previewRef.current?.innerHTML ?? '')}
            className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60"
          >
            Export .html
          </button>
          <button
            onClick={() => {
              if (confirm('Move this note to the trash?')) {
                del.mutate(noteId)
                navigate('/')
              }
            }}
            className="rounded border border-red-700/50 text-red-700 dark:text-red-400 px-2 py-1 hover:bg-red-700/10"
          >
            Trash
          </button>
        </span>
      </div>
    </div>
  )
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'offline': return 'Offline — will sync'
    case 'error': return 'Save failed'
    default: return ''
  }
}
