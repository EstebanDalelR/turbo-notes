import type { QueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { allEntries, isTempId, removeEntry, type OutboxOp } from './outbox'

/**
 * Replay the outbox against the server, in order. Notes/categories created
 * offline are mapped from their temporary id to the real server id, and that
 * mapping is applied to any later op that referenced the temp id.
 */

let flushing = false

function resolveId(id: number | string, map: Map<string, number>): number | string {
  if (isTempId(id) && map.has(id)) return map.get(id)!
  return id
}

async function applyOp(op: OutboxOp, ids: Map<string, number>): Promise<void> {
  switch (op.kind) {
    case 'note-create': {
      const { data } = await api.post('/notes/', op.data)
      ids.set(op.tempId, data.id)
      break
    }
    case 'note-update': {
      const id = resolveId(op.noteId, ids)
      if (isTempId(id)) return // create never succeeded; drop
      await api.patch(`/notes/${id}/`, op.data)
      break
    }
    case 'note-delete': {
      const id = resolveId(op.noteId, ids)
      if (isTempId(id)) return
      await api.delete(`/notes/${id}/`)
      break
    }
    case 'note-restore': {
      const id = resolveId(op.noteId, ids)
      if (isTempId(id)) return
      await api.post(`/notes/${id}/restore/`)
      break
    }
    case 'note-purge': {
      const id = resolveId(op.noteId, ids)
      if (isTempId(id)) return
      await api.delete(`/notes/${id}/purge/`)
      break
    }
    case 'attach': {
      const id = resolveId(op.noteId, ids)
      if (isTempId(id)) return
      const form = new FormData()
      form.append('note', String(id))
      form.append('file', op.file, op.name)
      await api.post('/attachments/', form)
      break
    }
    case 'category-create': {
      const { data } = await api.post('/categories/', op.data)
      ids.set(op.tempId, data.id)
      break
    }
    case 'category-update': {
      const id = resolveId(op.categoryId, ids)
      if (isTempId(id)) return
      await api.patch(`/categories/${id}/`, op.data)
      break
    }
    case 'category-delete': {
      const id = resolveId(op.categoryId, ids)
      if (isTempId(id)) return
      await api.delete(`/categories/${id}/`)
      break
    }
  }
}

export async function flushOutbox(queryClient: QueryClient): Promise<void> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  flushing = true
  const ids = new Map<string, number>()
  try {
    const entries = await allEntries()
    for (const entry of entries) {
      try {
        await applyOp(entry.op, ids)
        await removeEntry(entry.seq)
      } catch (err) {
        // Stop on the first failure so ordering is preserved; retry next time.
        // A 4xx that isn't worth retrying still blocks — acceptable for v1.
        console.warn('Outbox flush halted at op', entry.seq, err)
        break
      }
    }
  } finally {
    flushing = false
    // Pull fresh server state so optimistic/temp entries reconcile.
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
  }
}

/** Wire up reconnect-triggered flushing. Returns a cleanup function. */
export function installSync(queryClient: QueryClient): () => void {
  const handler = () => void flushOutbox(queryClient)
  window.addEventListener('online', handler)
  // Attempt an initial flush in case the app launched online with a backlog.
  void flushOutbox(queryClient)
  return () => window.removeEventListener('online', handler)
}
