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
      // Every new string is precompiled to an AST, and mailcow's strings are never compiled
      // (constitution IV), so the runtime needs no message compiler.
      dropMessageCompiler: true,
      // Only the app's new strings: mailcow's own strings are never compiled (constitution IV).
      include: [fileURLToPath(new URL('./src/i18n/messages/**', import.meta.url))],
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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'framework',
              test: /[\\/]node_modules[\\/](@vue|vue|vue-router|vue-i18n|@intlify|pinia|@tanstack)[\\/]/,
              priority: 20,
            },
            { name: 'icons', test: /[\\/]src[\\/]shared[\\/]icons[\\/]/, priority: 10 },
            // Every other module the entry loads statically goes into the entry chunk (UI 012 for
            // the smallest ones, UI 004 T111 for all): rolldown splits a module out when lazy chunks
            // share it, and the shell became a dozen small initial chunks, each a request of its own
            // with the full security headers.
            { name: 'shell', tags: ['$initial'], priority: 5 },
            // Sign-in also uses form feedback. Keep it separate from collection controls.
            {
              name: 'form-feedback',
              test: /[\\/]src[\\/]shared[\\/](components[\\/](FormField|ProblemMessage|ErrorSummary)\.vue|composables[\\/]useProblemForm\.ts)$/,
              priority: 2,
            },
            // Lists use these controls together. Keep them in one lazy chunk instead of a request
            // per tiny component; the higher-priority shell group still owns initial modules.
            {
              name: 'collection-ui',
              test: /[\\/]src[\\/]shared[\\/](components[\\/](ActiveFilterChips|BulkActionBar|BulkResultSummary|PaginationBar|SearchField|ListState|DomainPicker|LocaleNumberField|DateTime|PlainText|AclReadOnlyNote|FilterPanel)\.vue|composables[\\/](useListState|useBulkSelection|useStickyBarFocus)\.ts)$/,
              priority: 1,
            },
            // These four areas load their strings together. Ship one lazy file per locale.
            {
              name: (id) => `quarantine-messages-${id.split(/[\\/]/).at(-1)?.replace('.json', '')}`,
              test: /[\\/]src[\\/]i18n[\\/]messages[\\/](quarantine|quarantine-admin|spam-filter|rate-limits)[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  // mailcow serves its language files on the same origin as the API (`/lang/`, constitution IV).
  server: {
    proxy: {
      '/api/v2': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: false,
      },
      '/lang/': {
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
      '/lang/': {
        target: process.env.MOCK_API_TARGET ?? 'http://127.0.0.1:4010',
        changeOrigin: false,
      },
    },
    headers: readSecurityHeaders(),
  },
})
