import { useParams } from 'react-router-dom'
import { usePublicNote } from '../api/public'
import { Markdown } from '../components/Markdown'
import { ThemeToggle } from '../components/ThemeToggle'

export function PublicNote() {
  const { publicId } = useParams<{ publicId: string }>()
  const { data: note, isLoading, isError } = usePublicNote(publicId)

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-sepia-300/60 dark:border-sepia-700/60">
        <span className="font-display text-xl">Turbo</span>
        <ThemeToggle />
      </header>

      <article className="max-w-2xl mx-auto p-6">
        {isLoading ? (
          <p className="text-sepia-500">Loading…</p>
        ) : isError || !note ? (
          <p className="text-sepia-500 italic">This note is private or does not exist.</p>
        ) : (
          <>
            <h1 className="font-display text-4xl mb-1">{note.title || 'Untitled'}</h1>
            <p className="text-sm text-sepia-500 mb-6">
              by {note.author} · updated {new Date(note.updated_at).toLocaleDateString()}
            </p>
            <Markdown>{note.content}</Markdown>
            {note.attachments.length > 0 && (
              <div className="mt-8 border-t border-sepia-300/60 dark:border-sepia-700/60 pt-4">
                <h2 className="font-display text-lg mb-2">Attachments</h2>
                <ul className="space-y-1 text-sm">
                  {note.attachments.map((a) => (
                    <li key={a.id}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                        {a.original_name || 'file'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  )
}
