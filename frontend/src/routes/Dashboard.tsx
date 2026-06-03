import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../api/categories'
import { useCreateNote, useNotes } from '../api/notes'
import { ColorPicker } from '../components/ColorPicker'
import { NoteCard } from '../components/NoteCard'
import type { Category } from '../lib/types'

export function Dashboard() {
  const navigate = useNavigate()
  const { data: categories = [] } = useCategories()
  const { data: notes = [], isLoading } = useNotes(false)
  const createNote = useCreateNote()

  const [selected, setSelected] = useState<number | 'all'>('all')

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const visible = useMemo(() => {
    const list = selected === 'all' ? notes : notes.filter((n) => n.category === selected)
    return [...list].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }, [notes, selected])

  const newNote = async () => {
    const category = selected === 'all' ? null : selected
    const note = await createNote.mutateAsync({ title: '', content: '', category })
    navigate(`/note/${note.id}`)
  }

  return (
    <div className="flex flex-col md:flex-row">
      <Sidebar
        categories={categories}
        notes={notes}
        selected={selected}
        onSelect={setSelected}
      />

      <section className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">
            {selected === 'all' ? 'All notes' : categoryById.get(selected)?.name}
          </h2>
          <button
            onClick={newNote}
            className="rounded bg-sepia-600 text-sepia-50 px-3 py-1.5 text-sm font-display tracking-wide hover:bg-sepia-700"
          >
            + New note
          </button>
        </div>

        {isLoading ? (
          <p className="text-sepia-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sepia-500 italic">No notes here yet. Start one with “New note”.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                category={note.category ? categoryById.get(note.category) : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Sidebar({
  categories,
  notes,
  selected,
  onSelect,
}: {
  categories: Category[]
  notes: { category: number | null }[]
  selected: number | 'all'
  onSelect: (v: number | 'all') => void
}) {
  const navigate = useNavigate()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)

  const liveCount = (id: number | 'all') =>
    id === 'all' ? notes.length : notes.filter((n) => n.category === id).length

  const addCategory = async () => {
    if (!newName.trim()) return
    await createCategory.mutateAsync({ name: newName.trim(), color: '#8a6d3b' })
    setNewName('')
    setAdding(false)
  }

  const rowBase =
    'w-full text-left px-3 py-2 rounded flex items-center justify-between gap-2 text-sm'

  return (
    <aside className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-sepia-300/60 dark:border-sepia-700/60 p-3">
      <button
        onClick={() => onSelect('all')}
        className={`${rowBase} ${selected === 'all' ? 'bg-sepia-200/70 dark:bg-sepia-800/70' : 'hover:bg-sepia-200/50 dark:hover:bg-sepia-800/50'}`}
      >
        <span className="font-display">All notes</span>
        <span className="text-sepia-500">{liveCount('all')}</span>
      </button>

      <div className="mt-2 space-y-0.5">
        {categories.map((cat) => (
          <div key={cat.id}>
            <button
              onClick={() => onSelect(cat.id)}
              onDoubleClick={() => setEditing(editing === cat.id ? null : cat.id)}
              className={`${rowBase} ${selected === cat.id ? 'bg-sepia-200/70 dark:bg-sepia-800/70' : 'hover:bg-sepia-200/50 dark:hover:bg-sepia-800/50'}`}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </span>
              <span className="text-sepia-500">{liveCount(cat.id)}</span>
            </button>

            {editing === cat.id && (
              <div className="px-3 py-2 space-y-2 bg-sepia-100/60 dark:bg-sepia-950/40 rounded mt-0.5">
                <ColorPicker
                  value={cat.color}
                  onChange={(color) => updateCategory.mutate({ id: cat.id, data: { color } })}
                />
                {!cat.is_default && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete category “${cat.name}”? Its notes become uncategorized.`)) {
                        deleteCategory.mutate(cat.id)
                        setEditing(null)
                      }
                    }}
                    className="text-xs text-red-700 dark:text-red-400 underline"
                  >
                    Delete category
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex gap-1">
          <input
            value={newName}
            autoFocus
            placeholder="Category name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            className="flex-1 rounded border border-sepia-300 dark:border-sepia-700 bg-transparent px-2 py-1 text-sm"
          />
          <button onClick={addCategory} className="text-sm px-2 rounded bg-sepia-600 text-sepia-50">Add</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 text-sm text-sepia-600 dark:text-sepia-300 hover:underline px-3">
          + Add category
        </button>
      )}

      <hr className="my-3 border-sepia-300/60 dark:border-sepia-700/60" />
      <button
        onClick={() => navigate('/trash')}
        className={`${rowBase} hover:bg-sepia-200/50 dark:hover:bg-sepia-800/50`}
      >
        <span className="font-display">🗑 Trash</span>
      </button>
      <p className="text-[11px] text-sepia-500 mt-2 px-3">Double-click a category to recolor or delete it.</p>
    </aside>
  )
}
