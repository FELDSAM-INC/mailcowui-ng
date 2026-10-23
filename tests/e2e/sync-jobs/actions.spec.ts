import { openBulkActions } from '../fixtures/flows'
// UI 008 US4 activate, deactivate and schedule next (T055) under the 1:1 rule: the classic mass
// actions on a selection (one job or several), with one explicit confirmation for deactivating,
// the version as listed, changes elsewhere, the running note and the list updated in place.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entry, listReady, requestsOf } from './helpers'

async function select(page: Page, ...labels: string[]) {
  const toggle = page.getByRole('button', { name: 'Select', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  for (const label of labels) await page.getByRole('checkbox', { name: `Select ${label}` }).check()
}

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

test.describe('activating, deactivating and scheduling a sync job', () => {
  test('US4-AS1 FR-036 deactivating asks once and names the job; activating does not ask', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    await select(page, 'alice@mail.previous.example:993')
    await (await openBulkActions(page)).getByRole('button', { name: 'Deactivate' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Deactivate 1 sync jobs?')
    await expect(dialog).toContainText('alice@mail.previous.example:993')
    await expect(dialog).toContainText('They do not run until they are activated again.')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await requestsOf(mockApi, 'applySyncJobBulkAction')).toEqual([])
    await (await openBulkActions(page)).getByRole('button', { name: 'Deactivate' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('Done')
    await expect(entry(page, 2).locator('[data-active]')).toContainText('✕')
    const [request] = await requestsOf(mockApi, 'applySyncJobBulkAction')
    expect(request!.body).toMatchObject({ action: 'deactivate', targets: [{ id: '2' }] })
    expect((request!.body as { targets: { version: string }[] }).targets[0]!.version).toMatch(/^sj/)

    await select(page, 'alice@mail.previous.example:993')
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(entry(page, 2).locator('[data-active]')).toContainText('✓')
  })

  test('US4-AS2 "Schedule next" clears the last run and result without a confirmation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    await select(page, 'alice@mail.previous.example:993')
    await (await openBulkActions(page)).getByRole('button', { name: 'Schedule next' }).click()
    await expect(entry(page, 2).locator('[data-last-run]')).toHaveText('Waiting')
    await expect(entry(page, 2).locator('[data-result]')).toHaveText('-')
    const [request] = await requestsOf(mockApi, 'applySyncJobBulkAction')
    expect(request!.body).toMatchObject({ action: 'reschedule' })
  })

  test("the mailbox user's selection offers Activate, Deactivate and Remove, as the classic tab", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs')
    await listReady(page)
    await select(page, 'alice@mail.previous.example:993')
    const names = await bar(page).getByRole('button').allTextContents()
    expect(names.map((name) => name.trim())).toEqual([
      'Activate',
      'Deactivate',
      'Remove',
      'Clear selection',
    ])
  })

  test('FR-036 Edge: a job changed elsewhere is reported and can be retried', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    await select(page, 'alice@mail.previous.example:993')
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 45 } } })
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('Changed in the meantime')
    await expect(
      page.getByRole('checkbox', { name: 'Select alice@mail.previous.example:993' }),
    ).toBeChecked()
    await results.getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results).toContainText('Done')
  })

  test('FR-038 deactivating a running job says the run finishes on its own', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-running')
    await page.goto('sync-jobs')
    await listReady(page)
    await select(page, 'user2@old-provider.example@imap2.old-provider.example:993')
    await (await openBulkActions(page)).getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('alertdialog')).toContainText(
      'The run in progress is not interrupted and finishes on its own.',
    )
  })

  test('FR-047 a lost connection reports the outcome as unknown and changes nothing in the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    await select(page, 'alice@mail.previous.example:993')
    await page.route('**/api/v2/sync-jobs/bulk-actions', (route) => route.abort())
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('Outcome unknown')
    await expect(
      page.getByRole('checkbox', { name: 'Select alice@mail.previous.example:993' }),
    ).not.toBeChecked()
  })
})
