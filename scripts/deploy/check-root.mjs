// Run through mailcow-modern-ui/scripts/test-nginx.py with a real production UI build.
// The outer nginx is the supported mailcow template; only API data is synthetic.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const origin = process.env.ROOT_UI_ORIGIN
if (!origin) throw new Error('ROOT_UI_ORIGIN must point to the disposable nginx fixture')
const mock = 'http://127.0.0.1:4097'
const server = spawn(
  `${root}node_modules/.bin/tsx`,
  ['--tsconfig', 'tsconfig.vitest.json', 'tests/mocks/server.ts'],
  {
    cwd: root,
    detached: true,
    env: { ...process.env, MOCK_PORT: '4097' },
    stdio: ['ignore', 'ignore', 'inherit'],
  },
)
let browser
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${mock}/__mock/health`)).ok) break
    } catch {
      /* Starting. */
    }
    if (attempt > 100) throw new Error('Mock API did not start')
    await new Promise((done) => setTimeout(done, 100))
  }
  browser = await chromium.launch()
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } })
    context.setDefaultTimeout(15_000)
    const state = await fetch(`${mock}/__mock/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'domains-empty' }),
    }).then((response) => response.json())
    await context.addCookies([{ name: 'mock-scenario', value: state.id, url: origin }])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/(api\/v2|lang)\//, async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({ url: `${mock}${url.pathname}${url.search}` })
      await route.fulfill({ response })
    })
    await page.goto(`${origin}/domains`)
    await page.getByRole('heading', { name: 'Domains', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/domains')
    await page.reload()
    await page.getByRole('heading', { name: 'Domains', exact: true }).waitFor()
    await page.goto(`${origin}/ng/mailboxes?q=alice`)
    await page.getByRole('heading', { name: 'Mailboxes', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/mailboxes')
    assert.equal(new URL(page.url()).searchParams.get('q'), 'alice')
    if (width < 1024) await page.locator('[data-navigation-toggle]').click()
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    assert(
      hrefs.some((href) => href === '/domains'),
      'Router links use the selected root base',
    )
    assert(
      !hrefs.some((href) => href?.startsWith('/ng/domains')),
      'No old router base in navigation',
    )
    await page.locator('a[href="/domains"]').first().click()
    await page.getByRole('heading', { name: 'Domains', exact: true }).waitFor()

    const signOutState = await fetch(`${mock}/__mock/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'admin-password' }),
    }).then((response) => response.json())
    await context.addCookies([{ name: 'mock-scenario', value: signOutState.id, url: origin }])
    await page.goto(`${origin}/`)
    await page.waitForURL('**/sign-in')
    await page.getByRole('heading', { name: 'Login', exact: true }).waitFor()
    const referers = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v2/')) referers.push(request.headers().referer || '')
    })
    await page.goto(`${origin}/ng/sso/return?code=synthetic-private-code&state=synthetic-state`)
    await page.waitForFunction(() => !location.search && !location.pathname.startsWith('/ng/'))
    await page.waitForLoadState('networkidle')
    assert(
      !referers.some((value) => value.includes('synthetic-private-code')),
      'SSO callback query is scrubbed before API requests',
    )
    await page.goto(`${origin}/ng/reset-password?token=synthetic-reset-token`)
    await page.waitForFunction(() => location.pathname === '/reset-password' && !location.search)
    assert.deepEqual(errors, [])
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await context.close()
    console.log(
      `Root UI ${width}px: deep links, reload, old bookmarks, navigation, sign-in and callback scrubbing passed.`,
    )
  }
} finally {
  for (const context of browser?.contexts() || []) {
    for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' })
  }
  await browser?.close()
  // tsx starts a child process; close the whole fixture group, including inherited pipes.
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}
