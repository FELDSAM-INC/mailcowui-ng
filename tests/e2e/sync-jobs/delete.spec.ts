import { openBulkActions } from '../fixtures/flows'
// UI 008 US6 removing sync jobs (T069): the classic row action "Remove" with legacy's deletion
// dialog naming the job and saying that copied mail stays; cancelling; a selection with the number
// typed and one bulk request; an outdated single deletion confirmed again; the running note.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entry, entryIds, listReady, requestsOf, rowAction } from './helpers'

const label = (id: number) => `user${id}@old-provider.example@imap${id}.old-provider.example:993`

async function openRemove(page: Page, id: number) {
  await rowAction(page, id, 'Remove')
  return page.getByRole('alertdialog')
}

test.describe('removing sync jobs', () => {
  test('US6-AS1 FR-039 the dialog names the job and says copied mail stays; Cancel starts focused', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    const dialog = await openRemove(page, 2)
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog).toContainText('Please confirm your changes to the following object id')
    await expect(dialog).toContainText('alice@mail.previous.example:993')
    await expect(dialog).toContainText('alice@example.org')
    await expect(dialog).toContainText('Mail that was already copied stays in the mailbox.')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(dialog.getByRole('button', { name: 'Delete now' })).toHaveClass(/bg-red-700/)
    await expectAccessible()
  })

  test('US6-AS2 cancelling deletes nothing and returns the focus to the menu', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    const dialog = await openRemove(page, 2)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(entry(page, 2).getByRole('button', { name: /^Actions for / })).toBeFocused()
    expect(await requestsOf(mockApi, 'deleteSyncJob')).toEqual([])
  })

  test("FR-040 a removed job leaves the list, with legacy's message", async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    const dialog = await openRemove(page, 2)
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByText('Deleted syncjob ID 2').first()).toBeVisible()
    await expect(page.getByText('No matching records found')).toBeVisible()
    const [request] = await requestsOf(mockApi, 'deleteSyncJob')
    expect(request!.headers['if-match']).toMatch(/^"sj/)
  })

  test('US6-AS3 FR-039 removing three selected jobs needs "3" typed and sends one bulk request', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-bulk', { syncJobs: { failBulkItems: [] } })
    await page.goto('sync-jobs?sort=id&order=asc')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    for (const id of [1, 2, 3])
      await page.getByRole('checkbox', { name: `Select ${label(id)}` }).check()
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    for (const id of [1, 2, 3]) await expect(dialog).toContainText(label(id))
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Type 3 to confirm').fill('3')
    await confirm.click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('3 done')
    const [request] = await requestsOf(mockApi, 'applySyncJobBulkAction')
    expect(request!.body).toMatchObject({ action: 'delete' })
    expect(await entryIds(page)).not.toContain(1)
  })

  test('FR-039 a single deletion refused as outdated reloads the job and asks again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    const dialog = await openRemove(page, 2)
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 45 } } })
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    const again = page.getByRole('alertdialog')
    await expect(again).toContainText('alice@mail.previous.example:993')
    await again.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByText('No matching records found')).toBeVisible()
    const requests = await requestsOf(mockApi, 'deleteSyncJob')
    expect(requests.map((r) => r.status)).toEqual([412, 204])
  })

  test('FR-038 removing a running job says that the run finishes on its own', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-running')
    await page.goto('sync-jobs')
    await listReady(page)
    const dialog = await openRemove(page, 2)
    await expect(dialog).toContainText(
      'The run in progress is not interrupted and finishes on its own.',
    )
  })
})
