import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end and smoke projects (research R24, R25).
 *
 * The mock projects run against the production build (`dist/`) served by `vite preview` with the
 * production CSP, proxying `/api/v2` to the contract-validated mock server. `npm run build` must
 * run first; CI downloads the build artifact instead.
 */
const mockPort = Number(process.env.MOCK_PORT ?? 4010)
const previewPort = Number(process.env.PREVIEW_PORT ?? 4173)
const baseURL = `http://localhost:${previewPort}/ng/`
// UI 006: a build in another directory (PREVIEW_OUT_DIR), so that parallel runs in one checkout do
// not share `dist/`.
const previewOutDir = process.env.PREVIEW_OUT_DIR
const smokeOnly = process.argv.some((arg) => arg === '--project=smoke' || arg === 'smoke')
// scripts/smoke/stack-up.sh publishes the API dev stack on SMOKE_WEB_PORT and its Keycloak (with
// SMOKE_IDP=1) on SMOKE_KEYCLOAK_PORT.
const smokeWebPort = process.env.SMOKE_WEB_PORT ?? '18480'
const smokeKeycloakPort = process.env.SMOKE_KEYCLOAK_PORT ?? '18481'

const mobile = {
  viewport: { width: 360, height: 780 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
}

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The smoke tests share the real seeded accounts, so they run one at a time: the API refuses a
  // second TOTP code for alice in the same 30 s step, and the preferences test switches admin to
  // Czech while it runs.
  workers: smokeOnly ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      testDir: 'tests/e2e',
      use: { ...devices['Pixel 7'], ...mobile, browserName: 'chromium', baseURL },
    },
    {
      name: 'desktop-chromium',
      testDir: 'tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 900 },
        browserName: 'chromium',
        baseURL,
      },
    },
    {
      name: 'mobile-webkit',
      testDir: 'tests/e2e',
      // WebKit runs the two-theme accessibility checks much slower than Chromium; under a loaded
      // machine screens with long lists exceed the default 30 s.
      timeout: 60_000,
      grepInvert: /@virtual-authenticator/,
      use: { ...devices['iPhone 13'], ...mobile, browserName: 'webkit', baseURL },
    },
    {
      name: 'smoke',
      testDir: 'tests/smoke',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        baseURL: process.env.SMOKE_BASE_URL ?? `http://localhost:${smokeWebPort}/ng/`,
        // UI 012 (T101): the dev stack's API sends the browser to its Keycloak by service name
        // (http://keycloak:8080) and back to http://localhost/ng/sso/return without a port, so the
        // browser maps both to the published ports.
        launchOptions:
          process.env.SMOKE_IDP === '1'
            ? {
                args: [
                  `--host-resolver-rules=MAP keycloak:8080 127.0.0.1:${smokeKeycloakPort}, MAP localhost:80 127.0.0.1:${smokeWebPort}`,
                ],
              }
            : {},
      },
    },
  ],
  webServer: smokeOnly
    ? undefined
    : [
        {
          command: 'npm run mock:server',
          url: `http://127.0.0.1:${mockPort}/__mock/health`,
          env: { MOCK_PORT: String(mockPort) },
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
        },
        {
          command: `npm run preview -- --port ${previewPort} --strictPort${previewOutDir ? ` --outDir ${previewOutDir}` : ''}`,
          url: baseURL,
          env: { MOCK_API_TARGET: `http://127.0.0.1:${mockPort}` },
          reuseExistingServer: !process.env.CI,
        },
      ],
})
