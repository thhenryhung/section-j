import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Codespaces proxies the dev server through a *.app.github.dev hostname.
    host: true,
    allowedHosts: ['.app.github.dev', '.githubpreview.dev', 'localhost'],
  },
  build: {
    outDir: 'dist',
    // The encrypted payloads are large-ish binary blobs served from public/;
    // warn only on genuinely oversized JS chunks.
    chunkSizeWarningLimit: 900,
  },
})
