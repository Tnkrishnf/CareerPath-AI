import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies /api to Flask, so no CORS or API URLs are needed in the browser.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
})
