import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Unit tests run under jsdom. Kept separate from vite.config.ts so the PWA
// plugin (service worker, manifest) stays out of the test environment.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright specs live under e2e/ and are run by their own runner.
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
