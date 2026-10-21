// UI 010 US3, running the DNS diagnostics (T054): a run on opening with its progress, a result
// reused for ten minutes, the 45-second client timeout, the rate limit with its countdown, errors
// that keep the previous result, the scope, a result that arrives for another name, the
// announcements, and sign-out dropping held results.
import type { Page } from '@playwright/test'

import {
  openNavigation,
  passwordForm,
  politeRegion,
  signOutFromMenu,
  submitPassword,
} from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import type { MockApi } from '../fixtures/mock-api'
import { FIRST_LOAD, isNarrow } from './helpers'

const summary = (page: Page) => page.locator('[data-diagnostics-summary]')
const runAgain = (page: Page) => page.locator('[data-run-again]')

async function runs(mockApi: MockApi): Promise<number> {
  return (await mockApi.requests()).filter((item) => item.operationId === 'runDnsDiagnostics')
    .length
}

/** Options opens its ARC/DKIM tab; stay inside the app so held diagnostics survive navigation. */
async function openFromEntry(page: Page, name: string) {
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Options', exact: true }).click()
  await expect(page).toHaveURL(/\/dns\/dkim-keys$/)
  await expect(page.getByRole('heading', { level: 1, name: 'ARC/DKIM keys' })).toBeVisible()
  await page.locator(`[data-entry="${name}"]`).getByRole('link').first().click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page.getByRole('link', { name: 'DNS', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'DNS Records' })).toBeVisible()
}

test.describe('DNS diagnostics run', () => {
  test('FR-058 opening starts a run with its progress; a second run cannot start meanwhile', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await mockApi.delay('runDnsDiagnostics', 3000)
    await page.goto('dns/diagnostics/example.org')
    const status = page.locator('[data-run-status] [role="status"]')
    await expect(status).toContainText('can take up to 30 seconds', { timeout: FIRST_LOAD })
    await expect(runAgain(page)).toBeDisabled()
    await expectAccessible()
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await expect(runAgain(page)).toBeEnabled()
    expect(await runs(mockApi)).toBe(1)
  })

  test('US3-AS10 SC-016 a result of the last ten minutes is reused, an older one is run again', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('dns-admin')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: FIRST_LOAD })
    await openFromEntry(page, 'example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    expect(await runs(mockApi)).toBe(1)
    await page.goBack()
    await page.clock.fastForward('04:00')
    await page.getByRole('link', { name: 'DNS', exact: true }).click()
    await expect(summary(page)).toBeVisible()
    await expect(page.locator('[data-server-facts]')).toContainText('Checked')
    expect(await runs(mockApi)).toBe(1)
    await page.goBack()
    await page.clock.fastForward('08:00')
    await page.getByRole('link', { name: 'DNS', exact: true }).click()
    await expect.poll(() => runs(mockApi)).toBe(2)
  })

  test('FR-058 a run is stopped after 45 seconds, keeping the previous result', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('dns-admin')
    await page.goto('dns/diagnostics/example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await mockApi.delay('runDnsDiagnostics', 120_000)
    await runAgain(page).click()
    await expect(page.locator('[data-run-status] [role="status"]')).toBeVisible()
    await page.clock.fastForward(46_000)
    await expect(page.locator('[data-run-error]')).toContainText('longer than 45 seconds')
    await expect(page.locator('[data-run-error]')).toContainText('previous check')
    await expect(summary(page)).toBeVisible()
    await expect(runAgain(page)).toBeEnabled()
  })

  test('US3-AS7 FR-091 the runs left, then a refusal with the countdown, announced once when over', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('dns-diagnostics-rate-limited')
    await page.goto('dns/diagnostics/example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await expect(page.locator('[data-run-remaining]')).toHaveText('Checks left this minute: 2')
    await mockApi.patch({ dns: { rateLimit: { remaining: 0 } } })
    await runAgain(page).click()
    await expect(page.locator('[data-run-error]')).toContainText('Too many attempts')
    await expect(page.locator('[data-run-blocked]')).toContainText('Available again in')
    await expect(runAgain(page)).toBeDisabled()
    await expect(summary(page)).toBeVisible()
    await page.clock.fastForward(61_000)
    await expect(runAgain(page)).toBeEnabled()
    await expect(politeRegion(page)).toHaveText('Checking DNS is available again.')
  })

  test('US3-AS8 FR-004 a domain administrator opening an unmanaged name sees the not-found page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/diagnostics/shop.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys$/)
  })

  test('FR-069 a server error or a lost connection is explained, keeping the previous result', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/diagnostics/example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await mockApi.failNext('runDnsDiagnostics', { status: 500 })
    await runAgain(page).click()
    await expect(page.locator('[data-run-error]')).toContainText(
      'The DNS records could not be checked.',
    )
    await expect(summary(page)).toBeVisible()
    await page.route('**/api/v2/dns-diagnostics/**', (route) => route.abort())
    await runAgain(page).click()
    await expect(page.locator('[data-run-error]')).toContainText('could not be reached')
    await expect(summary(page)).toBeVisible()
  })

  test('Edge: a result arriving after moving to another name is kept for its own name', async ({
    page,
    mockApi,
  }) => {
    test.skip(isNarrow(page), 'one layout is enough for the cache rule')
    await mockApi.use('dns-admin')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: FIRST_LOAD })
    await mockApi.delay('runDnsDiagnostics', 2500)
    await openFromEntry(page, 'example.org')
    await openFromEntry(page, 'example.net')
    await expect(page.locator('[data-diagnostics="example.net"]')).toBeVisible()
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await expect(page.locator('[data-check-id="mx"]')).toContainText('example.net')
    await mockApi.delay('runDnsDiagnostics', 0)
    await page.goBack()
    await page.goBack()
    await page.goBack()
    await expect(page.locator('[data-diagnostics="example.org"]')).toBeVisible()
    await expect(summary(page)).toBeVisible()
    await expect(page.locator('[data-check-id="mx"]')).toContainText('example.org')
    expect(await runs(mockApi)).toBe(2)
  })

  test('FR-084 the start and the end are announced without moving the focus', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/diagnostics/example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await expect(politeRegion(page)).toContainText('DNS check finished:')
    await mockApi.delay('runDnsDiagnostics', 1500)
    await runAgain(page).click()
    await expect(politeRegion(page)).toHaveText('Checking the DNS records of example.org…')
    await expect(runAgain(page)).toBeFocused()
    await expect(politeRegion(page)).toContainText('DNS check finished:', { timeout: FIRST_LOAD })
  })

  test('sign-out drops held results, so signing in again starts a run', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: FIRST_LOAD })
    await openFromEntry(page, 'example.org')
    await expect(summary(page)).toBeVisible({ timeout: FIRST_LOAD })
    await signOutFromMenu(page)
    // The app stays loaded: the sign-in screen opens without a page load.
    await expect(passwordForm(page).username).toBeVisible()
    await submitPassword(page, 'admin')
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Login')
    await openFromEntry(page, 'example.org')
    await expect.poll(() => runs(mockApi)).toBe(2)
  })
})
