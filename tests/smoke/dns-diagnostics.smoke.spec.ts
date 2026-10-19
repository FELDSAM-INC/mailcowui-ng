// UI 010 US3 smoke test against the API dev stack (T058): diagnostics of example.org as `admin`
// with the server group, the downloaded zone file equal to the API's, and no server group for
// `reseller`. Every run counts against the rate limit (10 per minute): at most 3 per test.
import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { runDiagnostics } from './fixtures/dns-api'
import { signIn } from './fixtures/domains-api'

test.describe('@dns @read-only DNS diagnostics', () => {
  test('admin sees the checks with their states and the server-wide group', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('dns/diagnostics/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'DNS Records' })).toBeVisible()
    await expect(page.locator('[data-diagnostics-summary]')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { level: 2, name: 'Server-wide records' })).toBeVisible()
    await expect(page.locator('[data-check-id="mx"] [data-check-status]')).toBeVisible()
  })

  test('the downloaded zone file equals the zone file of the API', async ({ page }) => {
    await signIn(page, 'admin')
    const { zoneFile } = await runDiagnostics(page, 'example.org')
    await page.goto('dns/diagnostics/example.org')
    await expect(page.locator('[data-diagnostics-summary]')).toBeVisible({ timeout: 60_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-zone-download]').click(),
    ])
    expect(download.suggestedFilename()).toBe('example.org.txt')
    expect(readFileSync(await download.path(), 'utf8')).toBe(zoneFile)
  })

  test('reseller sees no server-wide group', async ({ page }) => {
    await signIn(page, 'reseller')
    await page.goto('dns/diagnostics/example.org')
    await expect(page.locator('[data-diagnostics-summary]')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'Server-wide records' })).toHaveCount(0)
  })
})
