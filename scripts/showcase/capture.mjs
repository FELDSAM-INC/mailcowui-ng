// Run after `npm run build`, using the repository's Playwright Docker image:
// docker run --rm --network host --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
//   mcr.microsoft.com/playwright:v1.64.1-noble node scripts/showcase/capture.mjs
// All accounts, domains and monitoring figures come from the synthetic test API.
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from 'playwright'

const root = process.cwd()
const sourceRevision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const output = resolve(root, 'public/showcase/screenshots')
const origin = 'http://127.0.0.1:4257'
const mock = 'http://127.0.0.1:4087'
const children = []
const GiB = 1024 ** 3
const domainNames = [
  'atlas.example',
  'cedar.example',
  'harbor.example',
  'juniper.example',
  'lumen.example',
  'maple.example',
  'northstar.example',
  'orchard.example',
  'riverside.example',
  'studio.example',
  'summit.example',
  'willow.example',
]
const domains = domainNames.map((name, index) => ({
  name,
  description: [
    'Atlas Creative',
    'Cedar Labs',
    'Harbor Studio',
    'Juniper Design',
    'Lumen Research',
    'Maple Collective',
    'Northstar Services',
    'Orchard Team',
    'Riverside Office',
    'Studio Projects',
    'Summit Group',
    'Willow Works',
  ][index],
  tags: index === 0 ? ['customer', 'premium'] : ['customer'],
  active: index !== 7,
  maxMailboxes: 50,
  maxAliases: 400,
  maxMailboxQuota: 10 * GiB,
  domainQuota: 100 * GiB,
  usage: {
    mailboxes: 8 + index * 2,
    resources: index % 3,
    aliases: 24 + index * 9,
    largestMailboxQuota: 5 * GiB,
    quotaAllocated: (32 + index * 3) * GiB,
    storageUsed: (12 + index * 2) * GiB,
    messages: 18524 + index * 2198,
  },
}))
const pages = [
  { name: 'mailboxes', path: 'mailboxes', scenario: 'admin-mailboxes-30' },
  {
    name: 'domains',
    path: 'domains',
    scenario: 'domains-empty',
    overrides: { domains: { add: domains } },
  },
  { name: 'sync-jobs', path: 'sync-jobs', scenario: 'sync-jobs-admin' },
  { name: 'queue', path: 'operations/mail-queue', scenario: 'ops-queue' },
  { name: 'system', path: 'operations/dashboard', scenario: 'admin-operations' },
]

function start(binary, args, env) {
  const child = spawn(resolve(root, 'node_modules/.bin', binary), args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  children.push(child)
}

async function ready(url) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* The child server is still starting. */
    }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Server did not become ready: ${url}`)
}

async function capture(browser, target, theme, mobile = false, menu = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'en-GB',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    const response = await fetch(`${mock}/__mock/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: target.scenario,
        overrides: {
          ...target.overrides,
          publicConfig: {
            pageTitle: 'mailcowui-ng',
            productName: 'mailcowui-ng',
            logos: { light: { url: '', isDefault: true }, dark: { url: '', isDefault: true } },
            announcement: { text: '', type: 'info', active: false },
            footerHtml: '',
            loginHelpHtml: '',
            appLinks: [
              {
                name: 'Webmail',
                url: '/SOGo/so',
                signedInUrl: '/SOGo/so',
                description: 'Open webmail',
                showOnLoginPage: true,
                source: 'builtIn',
              },
            ],
          },
          accounts: { admin: { preferences: { language: 'en-gb', theme, etag: '"showcase"' } } },
          ...(target.name === 'system'
            ? {
                operations: {
                  capabilities: { pollIntervalSeconds: 60 },
                  dashboard: {
                    containers: {
                      'sogo-mailcow': { state: 'running', running: true },
                      'clamd-mailcow': { health: 'healthy' },
                    },
                  },
                },
              }
            : {}),
        },
      }),
    })
    const state = await response.json()
    if (!state.id) throw new Error(JSON.stringify(state))
    await context.addCookies([
      { name: 'mock-scenario', value: state.id, domain: '127.0.0.1', path: '/' },
    ])
    await page.goto(`${origin}/ng/${target.path}`)
    await page.locator('main h1').waitFor()
    if (target.name === 'system') {
      await page.locator('[data-hostname]').waitFor()
      await page.locator('[data-containers] li').first().waitFor()
    } else if (mobile) {
      await page.locator('main [data-entry]').first().waitFor()
    } else {
      await page.locator('main table tbody tr').first().waitFor()
    }
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'))
    await page.waitForFunction(() => document.body.textContent.includes('mailcowui-ng'))
    if (!mobile && target.name === 'domains') {
      await page.locator('main [data-row-expand]').first().click()
    }
    if (!mobile && target.name === 'sync-jobs') {
      await page.locator('main [data-row-action-trigger]').first().click()
      await page.getByRole('menu').waitFor()
    }
    if (menu) {
      await page.locator('[data-navigation-toggle]').click()
      await page.getByRole('dialog').waitFor()
    }
    if (target.name === 'system') {
      // Collect real mock monitoring samples through the visible refresh action.
      for (let sample = 0; sample < 12; sample++) {
        await fetch(`${mock}/__mock/scenarios/${state.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations: { advanceHostClockSeconds: 5 } }),
        })
        await page.getByRole('button', { name: 'Refresh', exact: true }).click()
        await page.waitForLoadState('networkidle')
      }
      await page.locator('[data-live-chart] svg[role="img"]').first().waitFor()
      await page
        .locator('[data-cpu-memory]')
        .evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 94),
        )
    }
    if (mobile && target.name === 'domains') {
      await page
        .locator('main [data-entry]')
        .first()
        .evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 94),
        )
    }
    await page.mouse.move(mobile ? 389 : 1439, 1)
    await page.waitForTimeout(250)
    if (errors.length) throw new Error(errors.join('\n'))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw new Error(`Viewport overflow: ${target.name}`)
    const filename = `${mobile ? 'mobile-' : ''}${menu ? 'menu' : target.name}-${theme}.jpg`
    await page.screenshot({
      path: resolve(output, filename),
      type: 'jpeg',
      quality: 88,
      animations: 'disabled',
    })
    console.log(`Captured ${filename}`)
    return {
      file: filename,
      route: target.path,
      scenario: target.scenario,
      theme,
      viewport: mobile ? '390 × 844' : '1440 × 960',
    }
  } finally {
    await context.close()
  }
}

let browser
try {
  await mkdir(output, { recursive: true })
  start('tsx', ['--tsconfig', 'tsconfig.vitest.json', 'tests/mocks/server.ts'], {
    MOCK_PORT: '4087',
  })
  start('vite', ['preview', '--host', '127.0.0.1', '--port', '4257', '--strictPort'], {
    MOCK_API_TARGET: mock,
  })
  await Promise.all([ready(`${mock}/__mock/health`), ready(`${origin}/ng/`)])
  browser = await chromium.launch({ args: ['--no-sandbox'] })
  const captures = []
  for (const theme of ['light', 'dark']) {
    for (const target of pages) captures.push(await capture(browser, target, theme))
    for (const target of pages.slice(0, 2))
      captures.push(await capture(browser, target, theme, true))
    captures.push(await capture(browser, pages[0], theme, true, true))
  }
  await writeFile(
    resolve(output, 'capture-manifest.json'),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), sourceRevision, sampleData: true, captures }, null, 2)}\n`,
  )
} finally {
  await browser?.close()
  for (const child of children) child.kill('SIGTERM')
}
