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
        // The ONNX runtime wasm (~24 MB, bundled by transformers.js) is far too
        // big to precache into every install. It's runtime-cached below instead,
        // only when the user opts into the offline voice model.
        globIgnores: ['**/ort-wasm*.wasm'],
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
          {
            // On-device Whisper weights (Hugging Face) — cache the one-time
            // download so dictation works offline afterwards.
            urlPattern: ({ url }) =>
              url.origin === 'https://huggingface.co' || url.origin === 'https://cdn-lfs.huggingface.co',
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-models',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // ONNX runtime wasm (bundled same-origin by transformers.js) — cached
            // on first use so on-device transcription works offline thereafter.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /ort-wasm.*\.wasm$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnx-runtime',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
