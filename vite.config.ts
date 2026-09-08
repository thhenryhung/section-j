import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { siteConfig } from './src/lib/siteConfig'

/**
 * Vite doesn't template index.html by default. Rather than pull in full EJS
 * templating for two strings, just substitute the tenant-specific <title>
 * and meta description directly — a forking section only needs to edit
 * siteConfig.ts, not index.html itself.
 */
function siteConfigHtmlPlugin(): Plugin {
  return {
    name: 'site-config-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*<\/title>/, `<title>${siteConfig.orgName}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${siteConfig.description}" />`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), siteConfigHtmlPlugin()],
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
