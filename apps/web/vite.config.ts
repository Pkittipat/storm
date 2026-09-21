import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Workspace packages expose their TypeScript source under the `source` condition — no build step for the web app.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: {
    // The API has no /api prefix of its own; the proxy keeps the browser same-origin (no CORS setup per dev port).
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
