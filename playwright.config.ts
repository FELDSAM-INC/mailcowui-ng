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
const smokeOnly = process.argv.some((arg) => arg === '--project=smoke' || arg === 'smoke')

const mobile = {
  viewport: { width: 360, height: 780 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
}

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
        // scripts/smoke/stack-up.sh serves the API dev stack on SMOKE_WEB_PORT (default 18480).
        baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:18480/ng/',
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
          command: `npm run preview -- --port ${previewPort} --strictPort`,
          url: baseURL,
          env: { MOCK_API_TARGET: `http://127.0.0.1:${mockPort}` },
          reuseExistingServer: !process.env.CI,
        },
      ],
})
