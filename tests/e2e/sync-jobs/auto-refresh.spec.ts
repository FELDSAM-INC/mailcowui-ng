// UI 008 US1 the automatic refresh (T026, FR-014, research R7): every 30 s while a listed job runs,
// never otherwise, not while the page is hidden, a pause control, the inactivity limit with its
// notice, and nothing announced by an automatic refresh.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import type { MockApi } from '../fixtures/mock-api'
import { entry, listReady, requestsOf } from './helpers'

const listCalls = async (mockApi: MockApi) => (await requestsOf(mockApi, 'listSyncJobs')).length

async function setVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true })
    Object.defineProperty(document, 'hidden', { value: value === 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

async function open(page: Page, mockApi: MockApi, overrides = {}) {
  await page.clock.install()
  await mockApi.use('sync-jobs-running', overrides)
  await page.goto('sync-jobs')
  await listReady(page)
}

test.describe('sync job automatic refresh', () => {
  test('FR-014 refreshes every 30 s while a job runs and stops when the run ends', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    const start = await listCalls(mockApi)
    await page.clock.runFor(30_500)
    await expect.poll(() => listCalls(mockApi)).toBe(start + 1)
    await mockApi.patch({
      syncJobs: { finishRun: { id: 2, lastResult: 'succeeded', exitStatus: 'EX_OK' } },
    })
    await page.clock.runFor(30_000)
    await expect.poll(() => listCalls(mockApi)).toBe(start + 2)
    await expect(entry(page, 2).locator('[data-result]')).toContainText('Success')
    await page.clock.runFor(120_000)
    expect(await listCalls(mockApi)).toBe(start + 2)
  })

  test('FR-014 nothing is refetched without a running job', async ({ page, mockApi }) => {
    await page.clock.install()
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?running=no')
    await listReady(page)
    const start = await listCalls(mockApi)
    await page.clock.runFor(5 * 60_000)
    expect(await listCalls(mockApi)).toBe(start)
  })

  test('FR-014 a hidden page is not refreshed and becoming visible refetches once', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    const start = await listCalls(mockApi)
    await setVisibility(page, 'hidden')
    await page.clock.runFor(95_000)
    expect(await listCalls(mockApi)).toBe(start)
    await setVisibility(page, 'visible')
    await expect.poll(() => listCalls(mockApi)).toBe(start + 1)
  })

  test('WCAG 2.2.2 "Pause automatic refresh" stops it and "Resume" restarts at once', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await page.getByRole('button', { name: 'Pause automatic refresh' }).click()
    const start = await listCalls(mockApi)
    await page.clock.runFor(90_000)
    expect(await listCalls(mockApi)).toBe(start)
    await expectAccessible()
    await page.getByRole('button', { name: 'Resume automatic refresh' }).click()
    await expect.poll(() => listCalls(mockApi)).toBe(start + 1)
    await page.clock.runFor(30_500)
    await expect.poll(() => listCalls(mockApi)).toBe(start + 2)
  })

  test('the inactivity limit pauses refreshing with a notice; it does not resume by itself', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await page.clock.runFor(15 * 60_000 + 2_000)
    const notice = page.getByText('Automatic refresh paused because you have been inactive.')
    await expect(notice).toBeVisible()
    await expect(page.locator('[data-live="polite"]')).toContainText('paused because you have')
    const paused = await listCalls(mockApi)
    await page.mouse.move(10, 10)
    await page.clock.runFor(90_000)
    expect(await listCalls(mockApi)).toBe(paused)
    await expectAccessible()
    await page.getByRole('button', { name: 'Resume automatic refresh' }).click()
    await expect.poll(() => listCalls(mockApi)).toBe(paused + 1)
  })

  test('the inactivity limit follows a shorter session idle timeout', async ({ page, mockApi }) => {
    await open(page, mockApi, { idleTimeout: 300 })
    await page.clock.runFor(5 * 60_000 + 2_000)
    await expect(
      page.getByText('Automatic refresh paused because you have been inactive.'),
    ).toBeVisible()
  })

  test('automatic refreshes announce nothing, and one 30 s cycle serves several running jobs', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await mockApi.patch({ syncJobs: { startRun: 3 } })
    await page.evaluate(() => {
      const region = document.querySelector('[data-live="polite"]')
      if (region) region.textContent = ''
    })
    const start = await listCalls(mockApi)
    await page.clock.runFor(30_500)
    await expect.poll(() => listCalls(mockApi)).toBe(start + 1)
    await page.clock.runFor(30_000)
    await expect.poll(() => listCalls(mockApi)).toBe(start + 2)
    await expect(page.locator('[data-live="polite"]')).toHaveText('')
  })
})
