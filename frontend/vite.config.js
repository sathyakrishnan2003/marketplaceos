import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the
  // asset paths need that prefix. Left unset, the SPA is served from the API
  // origin instead (single-host deploy) and needs no prefix.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
