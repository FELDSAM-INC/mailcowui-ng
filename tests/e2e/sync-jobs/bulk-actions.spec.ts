// UI 008 US4 actions on several jobs (T056): one bulk request with each job's version as listed,
// the per-job summary, failed jobs kept selected for a retry, selection mode on phones, the page
// selection and its limit, the selection cleared by list changes, a lost connection, 25 outcomes,
// and no automatic refresh while selecting.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entries, isNarrow, listReady, requestsOf } from './helpers'

const label = (id: number) => `user${id}@old-provider.example@imap${id}.old-provider.example:993`
const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

async function startSelecting(page: Page) {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

test.describe('sync job bulk actions', () => {
  test('US4-AS3 FR-037 one request with the versions as listed; the failed job stays selected', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await startSelecting(page)
    for (const id of [6, 7, 8])
      await page.getByRole('checkbox', { name: `Select ${label(id)}` }).check()
    await bar(page).getByRole('button', { name: 'Activate' }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('2 done')
    await expect(results).toContainText('1 failed')
    await expect(results).toContainText(label(7))
    await expectAccessible()
    const [request] = await requestsOf(mockApi, 'applySyncJobBulkAction')
    const body = request!.body as { action: string; targets: { id: string; version: string }[] }
    expect(body.action).toBe('activate')
    expect(body.targets.map((target) => target.id)).toEqual(['6', '7', '8'])
    for (const target of body.targets) expect(target.version).toMatch(/^sj[0-9a-f]+$/)
    await expect(page.getByRole('checkbox', { name: `Select ${label(7)}` })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: `Select ${label(6)}` })).not.toBeChecked()
    await mockApi.patch({ syncJobs: { failBulkItems: [] } })
    await results.getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect
      .poll(async () => (await requestsOf(mockApi, 'applySyncJobBulkAction')).length)
      .toBe(2)
    const retry = (await requestsOf(mockApi, 'applySyncJobBulkAction'))[1]!
    expect((retry.body as { targets: { id: string }[] }).targets.map((t) => t.id)).toEqual(['7'])
  })

  test('US4-AS4 selection mode at 360 px has large checkboxes and a wrapping bar', async ({
    page,
    mockApi,
    expectTouchTargets,
    expectNoHorizontalScroll,
    expectAccessible,
  }) => {
    test.skip(!isNarrow(page), 'the phone layout')
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: `Select ${label(30)}` }).check()
    await expect(bar(page)).toContainText('1 selected')
    await expectTouchTargets()
    await expectNoHorizontalScroll(page, { widths: [360, 320] })
    await expectAccessible()
  })

  test('FR-037 "Toggle all" selects the page; list changes clear the selection; deactivating asks', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await expect(bar(page)).toContainText('25 selected')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText(/^0 selected$/)).toBeVisible()
    await page.getByRole('checkbox', { name: `Select ${label(5)}` }).check()
    await page.getByRole('searchbox', { name: 'Search:' }).fill('imap')
    await expect(page.getByText(/^0 selected$/)).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search:' }).fill('')
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: `Select ${label(1)}` }).check()
    await page.getByRole('checkbox', { name: `Select ${label(2)}` }).check()
    await bar(page).getByRole('button', { name: 'Deactivate' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Deactivate 2 sync jobs?')
    await expect(dialog).toContainText(label(1))
    await expect(dialog).toContainText(label(2))
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await bar(page).getByRole('button', { name: 'Schedule next' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('2 done')
  })

  test('FR-037 an outdated job stays selected and a deleted one leaves the selection', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: `Select ${label(3)}` }).check()
    await page.getByRole('checkbox', { name: `Select ${label(4)}` }).check()
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 3, intervalMinutes: 45 } } })
    await mockApi.patch({ syncJobs: { delete: 4 } })
    await bar(page).getByRole('button', { name: 'Activate' }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('1 changed in the meantime')
    await expect(results).toContainText('1 not found')
    await expect(page.getByRole('checkbox', { name: `Select ${label(3)}` })).toBeChecked()
    await expect(bar(page)).toContainText('1 selected')
  })

  test('FR-037 Edge: a lost connection reports every job unknown, clears the selection and retries nothing', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-bulk')
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: `Select ${label(1)}` }).check()
    await page.getByRole('checkbox', { name: `Select ${label(2)}` }).check()
    let calls = 0
    await page.route('**/api/v2/sync-jobs/bulk-actions', (route) => {
      calls += 1
      return route.abort()
    })
    const before = (await requestsOf(mockApi, 'listSyncJobs')).length
    await bar(page).getByRole('button', { name: 'Activate' }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('2 with unknown outcome')
    await expect(bar(page)).toContainText('0 selected')
    await expect
      .poll(async () => (await requestsOf(mockApi, 'listSyncJobs')).length)
      .toBeGreaterThan(before)
    expect(calls).toBe(1)
  })

  test('FR-037 the bulk limit of the capabilities caps the selection and says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-bulk', { syncJobs: { capabilities: { bulkLimit: 2 } } })
    await page.goto('sync-jobs')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await expect(bar(page)).toContainText('2 selected')
    await expect(bar(page)).toContainText('You can select at most 2 items for one action.')
    await bar(page).getByRole('button', { name: 'Activate' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
    const [request] = await requestsOf(mockApi, 'applySyncJobBulkAction')
    expect((request!.body as { targets: unknown[] }).targets).toHaveLength(2)
  })

  test('SC-008 an action on 25 jobs reports 25 outcomes', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-bulk', { syncJobs: { failBulkItems: [] } })
    await page.goto('sync-jobs')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await bar(page).getByRole('button', { name: 'Activate' }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('25 done')
    await expect(results.getByRole('listitem')).toHaveCount(25)
  })

  test('FR-014 no automatic refresh while selecting; it resumes afterwards', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('sync-jobs-running')
    await page.goto('sync-jobs')
    await listReady(page)
    await startSelecting(page)
    const start = (await requestsOf(mockApi, 'listSyncJobs')).length
    await page.clock.runFor(95_000)
    expect((await requestsOf(mockApi, 'listSyncJobs')).length).toBe(start)
    await page.getByRole('button', { name: 'Done selecting' }).click()
    await page.clock.runFor(31_000)
    await expect
      .poll(async () => (await requestsOf(mockApi, 'listSyncJobs')).length)
      .toBeGreaterThan(start)
    expect(await entries(page).count()).toBe(3)
  })
})
