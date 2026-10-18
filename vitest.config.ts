import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

/**
 * Unit and component tests (research R23): jsdom, a fresh Pinia, QueryClient and i18n per test,
 * MSW with the contract validator, and v8 coverage with stricter thresholds for
 * security-relevant code.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.spec.ts'],
      setupFiles: ['tests/setup/vitest.setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/api/generated/**',
          // Vendored TailAdmin primitives and icons (THIRD_PARTY_NOTICES.md): exercised through
          // the shared components and the end-to-end suite, not unit-tested line by line.
          'src/shared/ui/**',
          'src/shared/icons/**',
          'src/main.ts',
          'src/**/*.d.ts',
        ],
        reporter: ['text-summary', 'html', 'json-summary'],
        thresholds: {
          lines: 80,
          'src/api/**': { lines: 90 },
          'src/app/session/**': { lines: 90 },
          'src/app/router/**': { lines: 90 },
          'src/app/navigation/**': { lines: 90 },
          'src/shared/security/**': { lines: 90 },
          'src/shared/platform/webauthn/**': { lines: 90 },
        },
      },
    },
  }),
)
