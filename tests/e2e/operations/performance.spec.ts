// UI 011 (T144, research R22, SC-011, FR-091): chart rendering and the Markdown renderer are lazy.
// Screens without charts never request the chart chunk or `marked`; on the dashboard the figures
// are shown before the chart chunk arrives; the release-notes renderer is requested only when the
// notes open.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { openDashboard } from './dashboard-helpers'

const CHART = /\/assets\/LiveLineChart-[^/]+\.js$/
const MARKDOWN = /\/assets\/(marked[^/]*|render-release-notes-[^/]+)\.js$/

function recordAssets(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

test.describe('lazy chart and Markdown chunks @operations', () => {
  test('the container list stays in place when a delayed host overview arrives', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/v2/host', async (route) => {
      await held
      await route.continue()
    })
    try {
      await openDashboard(page)
      await expect(page.locator('[data-containers] li')).toHaveCount(20)
      await expect(page.locator('[data-update-status="updateAvailable"]')).toBeVisible()
      await expect(page.getByRole('progressbar', { name: 'Disk usage' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Show public IP' })).toBeVisible()
      const list = page.locator('[data-containers]')
      const before = await list.evaluate((element) => element.getBoundingClientRect().top + scrollY)
      release()
      await expect(page.locator('[data-hostname]')).toHaveText('mail.example.org')
      await expect(page.locator('[data-cpu]')).toContainText('4 Cores')
      const after = await list.evaluate((element) => element.getBoundingClientRect().top + scrollY)
      expect(
        Math.abs(after - before),
        'container list movement after the overview loads',
      ).toBeLessThan(4)
    } finally {
      release()
    }
  })

  for (const [name, path, heading] of [
    ['logs', 'operations/logs/postfix', 'Postfix'],
    ['mail queue', 'operations/mail-queue', 'Queue Manager'],
    ['ban service', 'operations/fail2ban', 'Fail2ban parameters'],
  ] as const) {
    test(`FR-091 SC-011 the ${name} screen loads no chart and no Markdown chunk`, async ({
      page,
      mockApi,
    }) => {
      await mockApi.use('admin-operations')
      const urls = recordAssets(page)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({
        timeout: 15_000,
      })
      await page.waitForLoadState('networkidle')
      expect(urls.filter((url) => CHART.test(url) || MARKDOWN.test(url))).toEqual([])
    })
  }

  test('FR-091 SC-011 the dashboard figures are shown before the chart chunk arrives', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(CHART, async (route) => {
      await held
      await route.continue()
    })
    await openDashboard(page)
    await expect(page.locator('[data-cpu]')).toContainText('@')
    await expect(page.locator('[data-memory]')).toContainText('@')
    await expect(page.locator('[data-cpu-memory] figure svg')).toHaveCount(0)
    release()
    await expect(page.locator('[data-cpu-memory] figure').first()).toBeVisible()
  })

  test('FR-028 the release-notes renderer is requested only when the notes open', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    const urls = recordAssets(page)
    await openDashboard(page)
    await expect(page.locator('[data-update-status="updateAvailable"]')).toBeVisible()
    expect(urls.filter((url) => MARKDOWN.test(url))).toEqual([])
    await page
      .locator('[data-update-status="updateAvailable"]')
      .getByRole('button', { name: '2026-10' })
      .click()
    await expect(page.getByRole('dialog', { name: 'New Release 2026-10' })).toBeVisible()
    expect(urls.filter((url) => MARKDOWN.test(url)).length).toBeGreaterThan(0)
  })
})
