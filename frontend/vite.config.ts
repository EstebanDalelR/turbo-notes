import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Turbo Notes',
        short_name: 'Turbo',
        description: 'A sepia-toned, offline-capable markdown notes app.',
        theme_color: '#8a6d3b',
        background_color: '#f4ead3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/media/, /^\/admin/],
        runtimeCaching: [
          {
            // Cache GET API responses so notes/categories are readable offline.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Cache viewed attachments on demand.
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'media-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Enable the service worker in `npm run dev` too, so offline (caching the
      // app shell / editor route, the API GET cache, and the navigate-fallback)
      // can be exercised without a production build. `navigateFallback` serves
      // index.html for deep links like /note/<id> when offline.
      // Trade-off: a dev SW can serve stale assets after big changes — if dev
      // ever looks out of date, unregister it in DevTools → Application, or run
      // with `--mode nopwa` / set enabled:false temporarily.
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
        suppressWarnings: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Same-origin in dev so session + CSRF cookies work without CORS headaches.
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
      '/media': { target: 'http://localhost:8000', changeOrigin: false },
    },
  },
})
