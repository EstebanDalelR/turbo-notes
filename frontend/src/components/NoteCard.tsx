import { Link } from 'react-router-dom'
import type { Category, Note } from '../lib/types'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Strip markdown to a short plain-text preview. */
function preview(content: string): string {
  return content
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function NoteCard({ note, category }: { note: Note; category?: Category }) {
  const color = category?.color ?? '#8a6d3b'
  return (
    <Link
      to={`/note/${note.id}`}
      className="group block h-44 rounded-lg shadow-paper overflow-hidden border-l-4 bg-sepia-50 dark:bg-sepia-900 hover:-translate-y-0.5 transition-transform"
      style={{ borderLeftColor: color, backgroundColor: `${color}14` }}
    >
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-display text-lg truncate">{note.title || 'Untitled'}</h3>
          {note.is_public && (
            <span className="text-[10px] uppercase tracking-wide rounded px-1 py-0.5 bg-sepia-300/70 dark:bg-sepia-700/70">
              public
            </span>
          )}
        </div>
        <p className="text-sm text-sepia-700 dark:text-sepia-300 leading-snug flex-1 overflow-hidden line-clamp-5">
          {preview(note.content) || 'No content yet…'}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-sepia-500 dark:text-sepia-400">
          <span style={{ color }}>{category?.name ?? 'Uncategorized'}</span>
          <span>{timeAgo(note.updated_at)}</span>
        </div>
      </div>
    </Link>
  )
}
