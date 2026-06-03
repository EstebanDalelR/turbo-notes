import axios from 'axios'

// Same-origin in dev (Vite proxies /api to Django), so cookies just work.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

let csrfReady: Promise<void> | null = null

/** Ensure we hold a CSRF cookie before issuing unsafe requests. */
export function ensureCsrf(): Promise<void> {
  if (!csrfReady) {
    csrfReady = api.get('/auth/csrf/').then(() => undefined)
  }
  return csrfReady
}

// Prime the CSRF cookie ahead of the first mutation.
api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    await ensureCsrf()
  }
  return config
})

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}
