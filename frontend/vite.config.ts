import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev server forwards API calls to the backend, so the browser sees one origin.
  const api = env.VITE_DEV_API_PROXY || 'http://localhost:8000'
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': api, '/media': api },
    },
    build: { chunkSizeWarningLimit: 2500 },
    test: {
      // Unit tests live in the repo-level tests/ folder.
      include: ['../tests/frontend/**/*.test.ts'],
      globals: true,
    },
  }
})
