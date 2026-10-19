// UI 003 US4, deleting a mailbox from the list (T080) with legacy's confirmation ("Confirm
// deletion", "Delete now", "Cancel") and the impact of the deletion preview; legacy keeps deletion
// in the list, so the mailbox page has none (plan.md, legacy form map part 3).
import type { Page } from '@playwright/test'

import { entry, listReady } from '../domains/helpers'
import { expect, test } from '../fixtures/test'

async function remove(page: Page, address: string) {
  await page.goto(`mailboxes?q=${address.split('@')[0]}`)
  await listReady(page)
  await entry(page, address)
    .getByRole('button', { name: `Remove ${address}` })
    .click()
}

const dialog = (page: Page) => page.getByRole('alertdialog')

test.describe('mailbox deletion', () => {
  test('US4-AS1 US4-AS2 FR-013 FR-045 FR-046 the impact, Cancel focused, then removed and announced', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-delete')
    await remove(page, 'big@a.example')
    await expect(dialog(page).getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(dialog(page)).toContainText('big@a.example')
    await expect(dialog(page)).toContainText('2 GiB in 10,000 messages')
    await expect(dialog(page)).toContainText('purged after 5 days')
    await expect(dialog(page)).toContainText('Passkeys: 1')
    await expect(dialog(page)).toContainText('App passwords: 2')
    await expect(dialog(page)).toContainText('Aliases that keep their other recipients: 2')
    await expect(dialog(page)).toContainText('team@a.example')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-success]')).toHaveText(
      'Mailbox big@a.example has been removed',
    )
    await expect(entry(page, 'big@a.example')).toHaveCount(0)
  })

  test('US4-AS3 FR-047 the mail store is down: nothing removed, still listed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-delete')
    await remove(page, 'broken@a.example')
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog(page)).toContainText('broken@a.example was not removed')
    await expect(dialog(page)).toContainText('Nothing was deleted.')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(entry(page, 'broken@a.example')).toBeVisible()
  })

  test('US4-AS4 FR-044 SC-006 changed after opening: nothing deleted, the impact is shown again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-delete')
    await remove(page, 'big@a.example')
    await expect(dialog(page)).toContainText('Passkeys: 1')
    await mockApi.patch({ mailboxes: { set: { 'big@a.example': { displayName: 'Renamed' } } } })
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog(page)).toContainText(
      'The mailbox was changed in the meantime. Check the impact again.',
    )
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(entry(page, 'big@a.example')).toBeVisible()
  })

  test('US4-AS5 deleted elsewhere: "no longer exists", and the list is refreshed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-delete')
    await remove(page, 'big@a.example')
    await expect(dialog(page)).toContainText('Passkeys: 1')
    await mockApi.patch({ mailboxes: { remove: ['big@a.example'] } })
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog(page)).toContainText('This mailbox no longer exists.')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(entry(page, 'big@a.example')).toHaveCount(0)
  })

  test('blockers prevent the deletion and offer "Check again"', async ({ page, mockApi }) => {
    await mockApi.use('delete-store-unreachable')
    await remove(page, 'big@a.example')
    await expect(dialog(page)).toContainText('big@a.example cannot be removed now:')
    await expect(dialog(page)).toContainText('The mail store is unreachable.')
    await expect(dialog(page).getByRole('button', { name: 'Delete now' })).toHaveCount(0)
    await dialog(page).getByRole('button', { name: 'Check again' }).click()
    await expect(dialog(page).getByRole('button', { name: 'Delete now' })).toBeVisible()
  })

  test('504 outcome unknown: said so, and the mailbox is still listed after the refresh', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-delete')
    await remove(page, 'slow@a.example')
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog(page)).toContainText('It is unknown whether the action was completed.')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(entry(page, 'slow@a.example')).toBeVisible()
  })

  test('FR-066 one deletion request, however often the action is pressed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-delete', { delays: { deleteMailbox: 1500 } })
    await remove(page, 'big@a.example')
    await dialog(page).getByRole('button', { name: 'Delete now' }).click()
    await entry(page, 'big@a.example')
      .getByRole('button', { name: 'Remove big@a.example' })
      .click({ timeout: 1000 })
      .catch(() => undefined)
    await expect(page.locator('[data-success]')).toBeVisible()
    const deletes = (await mockApi.requests()).filter((r) => r.operationId === 'deleteMailbox')
    expect(deletes).toHaveLength(1)
  })
})
