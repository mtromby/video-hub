import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages: project sites live at /REPO/; user/org pages use repo NAME.github.io at /.
 * GITHUB_REPOSITORY is set automatically in Actions (owner/repo).
 */
function productionBase(): string {
  const override = process.env.VITE_BASE_PATH?.trim()
  if (override) {
    const withLead = override.startsWith('/') ? override : `/${override}`
    return withLead.endsWith('/') ? withLead : `${withLead}/`
  }
  const full = process.env.GITHUB_REPOSITORY
  if (full) {
    const repo = full.split('/')[1]
    if (/^[a-z0-9-]+\.github\.io$/i.test(repo)) return '/'
    return `/${repo}/`
  }
  return '/video-hub/'
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : productionBase(),
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
