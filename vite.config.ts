import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Reads the `add_header … always;` lines of the image's nginx snippet, so that `vite preview`
 * (end-to-end tests, Lighthouse) sends exactly the production security headers (research R18).
 */
export function readSecurityHeaders(
  file = fileURLToPath(new URL('./docker/nginx/security-headers.conf', import.meta.url)),
): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*add_header\s+([A-Za-z-]+)\s+"([^"]*)"\s+always;\s*$/.exec(line)
    if (match?.[1] && match[2] !== undefined) {
      headers[match[1]] = match[2]
    }
  }
  return headers
}

export default defineConfig({
  base: '/ng/',
  plugins: [
    vue(),
    tailwindcss(),
    VueI18nPlugin({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: false,
      include: [
        fileURLToPath(new URL('./src/i18n/messages/**', import.meta.url)),
        fileURLToPath(new URL('./src/i18n/legacy/**', import.meta.url)),
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    manifest: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: 'hidden',
  },
  server: {
    proxy: {
      '/api/v2': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
  preview: {
    proxy: {
      '/api/v2': {
        target: process.env.MOCK_API_TARGET ?? 'http://127.0.0.1:4010',
        changeOrigin: false,
      },
    },
    headers: readSecurityHeaders(),
  },
})
