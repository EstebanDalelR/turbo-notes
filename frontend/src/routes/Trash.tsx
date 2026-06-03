import { useNavigate } from 'react-router-dom'
import { useNotes, usePurgeNote, useRestoreNote } from '../api/notes'

export function Trash() {
  const navigate = useNavigate()
  const { data: notes = [], isLoading } = useNotes(true)
  const restore = useRestoreNote()
  const purge = usePurgeNote()

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/')} className="rounded border border-sepia-400/60 px-2 py-1 text-sm hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">← Back</button>
        <h2 className="font-display text-xl">Trash</h2>
      </div>

      {isLoading ? (
        <p className="text-sepia-500">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sepia-500 italic">The trash is empty.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-center justify-between gap-3 bg-sepia-50 dark:bg-sepia-900 rounded p-3 shadow-paper">
              <span className="truncate font-display">{note.title || 'Untitled'}</span>
              <span className="flex gap-2 text-sm shrink-0">
                <button onClick={() => restore.mutate(note.id)} className="rounded border border-sepia-400/60 px-2 py-1 hover:bg-sepia-200/60 dark:hover:bg-sepia-800/60">Restore</button>
                <button
                  onClick={() => {
                    if (confirm('Permanently delete this note? This cannot be undone.')) purge.mutate(note.id)
                  }}
                  className="rounded border border-red-700/50 text-red-700 dark:text-red-400 px-2 py-1 hover:bg-red-700/10"
                >
                  Delete forever
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
