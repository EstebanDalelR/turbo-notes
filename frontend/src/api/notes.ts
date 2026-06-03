import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api, isOffline } from './client'
import { enqueue, isTempId, newTempId } from '../offline/outbox'
import type { Note } from '../lib/types'

type NoteId = number | string

const listKey = (trashed: boolean) => ['notes', { trashed }] as const

function isNetworkError(err: unknown): boolean {
  // axios sets no `response` for network/offline failures (vs. a 4xx/5xx).
  return !(err as { response?: unknown } | undefined)?.response
}

const noteKey = (id: NoteId) => ['note', String(id)] as const

function patchNoteInCache(qc: QueryClient, id: NoteId, patch: Partial<Note>) {
  for (const trashed of [false, true]) {
    qc.setQueryData<Note[]>(listKey(trashed), (old) =>
      old?.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    )
  }
  // Also patch the single-note cache the Editor reads from, so fields it shows
  // straight off `note` (e.g. is_public) reflect the edit without a reload.
  qc.setQueryData<Note | undefined>(noteKey(id), (old) =>
    old ? { ...old, ...patch } : old,
  )
}

export function useNotes(trashed = false) {
  return useQuery<Note[]>({
    queryKey: listKey(trashed),
    queryFn: async () => {
      const { data } = await api.get<Note[]>('/notes/', {
        params: trashed ? { trashed: 'true' } : undefined,
      })
      return data
    },
  })
}

/** Read a single note from the cached lists (works for temp/offline notes too). */
export function useNote(id: NoteId | undefined) {
  const qc = useQueryClient()
  const find = () => {
    for (const trashed of [false, true]) {
      const note = qc
        .getQueryData<Note[]>(listKey(trashed))
        ?.find((n) => String(n.id) === String(id))
      if (note) return note
    }
    return undefined
  }
  return useQuery<Note | undefined>({
    queryKey: noteKey(id ?? ''),
    enabled: id !== undefined,
    queryFn: async () => {
      if (id !== undefined && !isTempId(id)) {
        try {
          const { data } = await api.get<Note>(`/notes/${id}/`)
          return data
        } catch {
          return find()
        }
      }
      return find()
    },
    initialData: find,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Note>): Promise<Note> => {
      if (isOffline()) {
        const tempId = newTempId()
        const now = new Date().toISOString()
        const optimistic: Note = {
          id: tempId as unknown as number,
          title: input.title ?? '',
          content: input.content ?? '',
          category: input.category ?? null,
          is_public: false,
          public_id: tempId,
          created_at: now,
          updated_at: now,
          client_updated_at: now,
          deleted_at: null,
          attachments: [],
        }
        await enqueue({ kind: 'note-create', tempId, data: input as Record<string, unknown> })
        qc.setQueryData<Note[]>(listKey(false), (old) => [optimistic, ...(old ?? [])])
        return optimistic
      }
      const { data } = await api.post<Note>('/notes/', input)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: NoteId; data: Partial<Note> }) => {
      const payload = { ...data, client_updated_at: new Date().toISOString() }
      if (isOffline() || isTempId(id)) {
        await enqueue({ kind: 'note-update', noteId: id, data: payload as Record<string, unknown> })
        return payload
      }
      try {
        const { data: saved } = await api.patch<Note>(`/notes/${id}/`, payload)
        return saved
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'note-update', noteId: id, data: payload as Record<string, unknown> })
          return payload
        }
        throw err
      }
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['notes'] })
      patchNoteInCache(qc, id, { ...data, updated_at: new Date().toISOString() })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: NoteId) => {
      if (isOffline() || isTempId(id)) {
        await enqueue({ kind: 'note-delete', noteId: id })
        return
      }
      await api.delete(`/notes/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useRestoreNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: NoteId) => {
      if (isOffline() || isTempId(id)) {
        await enqueue({ kind: 'note-restore', noteId: id })
        return
      }
      await api.post(`/notes/${id}/restore/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function usePurgeNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: NoteId) => {
      if (isOffline() || isTempId(id)) {
        await enqueue({ kind: 'note-purge', noteId: id })
        return
      }
      await api.delete(`/notes/${id}/purge/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUploadAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, file }: { noteId: NoteId; file: File }) => {
      if (isOffline() || isTempId(noteId)) {
        await enqueue({
          kind: 'attach',
          noteId,
          file,
          name: file.name,
          contentType: file.type,
        })
        return
      }
      const form = new FormData()
      form.append('note', String(noteId))
      form.append('file', file)
      await api.post('/attachments/', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (attachmentId: number) => {
      await api.delete(`/attachments/${attachmentId}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}
