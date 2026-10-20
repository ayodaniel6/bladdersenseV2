import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development Vite serves the app on :5173 and forwards the server routes
// to Express on :3000, so the browser sees one origin exactly as in production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/r/': 'http://localhost:3000',
    },
  },
})
