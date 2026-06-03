import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/**
 * A durable, ordered queue of mutations made while offline. Each op is replayed
 * in sequence once connectivity returns. Notes created offline get a temporary
 * string id ("tmp-..."); the flush step remaps it to the real server id and
 * rewrites later ops that referenced it.
 */

export type OutboxOp =
  | { kind: 'note-create'; tempId: string; data: Record<string, unknown> }
  | { kind: 'note-update'; noteId: number | string; data: Record<string, unknown> }
  | { kind: 'note-delete'; noteId: number | string }
  | { kind: 'note-restore'; noteId: number | string }
  | { kind: 'note-purge'; noteId: number | string }
  | { kind: 'attach'; noteId: number | string; file: Blob; name: string; contentType: string }
  | { kind: 'category-create'; tempId: string; data: Record<string, unknown> }
  | { kind: 'category-update'; categoryId: number | string; data: Record<string, unknown> }
  | { kind: 'category-delete'; categoryId: number | string }

export interface OutboxEntry {
  seq: number
  op: OutboxOp
  createdAt: number
}

interface OutboxDB extends DBSchema {
  outbox: { key: number; value: OutboxEntry }
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>('turbo-outbox', 1, {
      upgrade(database) {
        database.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
      },
    })
  }
  return dbPromise
}

export async function enqueue(op: OutboxOp): Promise<void> {
  const database = await db()
  await database.add('outbox', { op, createdAt: Date.now() } as OutboxEntry)
}

export async function allEntries(): Promise<OutboxEntry[]> {
  const database = await db()
  const entries = await database.getAll('outbox')
  return entries.sort((a, b) => a.seq - b.seq)
}

export async function removeEntry(seq: number): Promise<void> {
  const database = await db()
  await database.delete('outbox', seq)
}

export async function pendingCount(): Promise<number> {
  const database = await db()
  return database.count('outbox')
}

export function newTempId(prefix = 'tmp'): string {
  // crypto.randomUUID is available in all target browsers.
  return `${prefix}-${crypto.randomUUID()}`
}

export function isTempId(id: number | string): id is string {
  return typeof id === 'string' && id.startsWith('tmp-')
}
