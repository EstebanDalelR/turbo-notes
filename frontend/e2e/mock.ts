import type { Page, Route } from '@playwright/test'

/** A tiny in-memory stand-in for the Django API, wired up via page.route. */
export interface MockState {
  loggedIn: boolean
  transcript: string
  notes: Record<string, Note>
  nextId: number
}

interface Note {
  id: number
  title: string
  content: string
  category: number | null
  is_public: boolean
  public_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  attachments: unknown[]
}

const USER = { id: 1, username: 'tester', email: 'tester@example.com' }

const CATEGORIES = [
  { id: 1, name: 'Grocery list', color: '#7a8450', is_default: true, created_at: '2026-01-01T00:00:00Z', note_count: 0 },
  { id: 2, name: 'Money ideas', color: '#8a6d3b', is_default: true, created_at: '2026-01-01T00:00:00Z', note_count: 0 },
  { id: 3, name: 'Random thoughts', color: '#9c6b4a', is_default: true, created_at: '2026-01-01T00:00:00Z', note_count: 0 },
  { id: 4, name: 'Projects', color: '#5b6b7a', is_default: true, created_at: '2026-01-01T00:00:00Z', note_count: 0 },
]

function makeNote(id: number, patch: Partial<Note>): Note {
  const now = '2026-06-03T12:00:00Z'
  return {
    id,
    title: '',
    content: '',
    category: null,
    is_public: false,
    public_id: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    attachments: [],
    ...patch,
  }
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * Install API mocks on a page. Returns the mutable state so tests can pre-seed
 * (e.g. start logged in, set the transcript the fake server returns).
 */
export async function installApiMock(page: Page, init: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = {
    loggedIn: false,
    transcript: 'hello from the server',
    notes: {},
    nextId: 1,
    ...init,
  }

  // Match only real API calls (origin + "/api/..."), NOT the app's source
  // modules served by Vite from "/src/api/..." — a "**/api/**" glob would catch
  // those too and break the module graph.
  await page.route(/:\/\/[^/]+\/api\//, async (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')

    // --- auth ---
    if (path === '/auth/csrf/') return json(route, 200, { csrfToken: 'test-csrf' })
    if (path === '/auth/me/')
      return state.loggedIn ? json(route, 200, USER) : json(route, 403, { detail: 'no' })
    if (path === '/auth/login/' && method === 'POST') {
      state.loggedIn = true
      return json(route, 200, USER)
    }
    if (path === '/auth/register/' && method === 'POST') {
      state.loggedIn = true
      return json(route, 201, USER)
    }
    if (path === '/auth/logout/' && method === 'POST') {
      state.loggedIn = false
      return json(route, 204, {})
    }

    // --- categories ---
    if (path === '/categories/' && method === 'GET') return json(route, 200, CATEGORIES)

    // --- transcription ---
    if (path === '/transcribe/' && method === 'POST')
      return json(route, 200, { text: state.transcript })

    // --- notes ---
    const idMatch = path.match(/^\/notes\/(\d+)\/?$/)
    const restoreMatch = path.match(/^\/notes\/(\d+)\/restore\/?$/)

    if (path.startsWith('/notes/') && restoreMatch && method === 'POST') {
      const note = state.notes[restoreMatch[1]]
      if (note) note.deleted_at = null
      return json(route, 200, note)
    }
    if (path === '/notes/' && method === 'GET') {
      const trashed = url.searchParams.get('trashed') === 'true'
      const list = Object.values(state.notes).filter((n) =>
        trashed ? n.deleted_at !== null : n.deleted_at === null,
      )
      return json(route, 200, list)
    }
    if (path === '/notes/' && method === 'POST') {
      const body = req.postDataJSON() ?? {}
      const note = makeNote(state.nextId++, body)
      state.notes[note.id] = note
      return json(route, 201, note)
    }
    if (idMatch && method === 'GET') {
      const note = state.notes[idMatch[1]]
      return note ? json(route, 200, note) : json(route, 404, { detail: 'not found' })
    }
    if (idMatch && method === 'PATCH') {
      const note = state.notes[idMatch[1]]
      if (note) Object.assign(note, req.postDataJSON() ?? {}, { updated_at: '2026-06-03T12:05:00Z' })
      return json(route, 200, note)
    }
    if (idMatch && method === 'DELETE') {
      const note = state.notes[idMatch[1]]
      if (note) note.deleted_at = '2026-06-03T12:10:00Z'
      return json(route, 204, {})
    }

    return json(route, 404, { detail: `unmocked: ${method} ${path}` })
  })

  return state
}
