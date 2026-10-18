// UI 002 US4, deleting a domain (T065) from the list, as in legacy (docs/conventions.md "Detail
// pages"): the impact from the deletion preview, the typed name, blockers, refusals and the edge
// cases.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entry, isNarrow, listReady } from './helpers'

async function openList(page: Page) {
  await page.goto('domains')
  await listReady(page)
}

async function startDelete(page: Page, name: string) {
  await page.getByRole('button', { name: `Actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
}

const dialog = (page: Page) => page.getByRole('alertdialog')
const confirmButton = (page: Page) => dialog(page).getByRole('button', { name: 'Delete domain' })
const typed = (page: Page) => dialog(page).getByRole('textbox')

async function deletes(mockApi: {
  requests(): Promise<{ operationId: string | null; headers: Record<string, string> }[]>
}) {
  return (await mockApi.requests()).filter((request) => request.operationId === 'deleteDomain')
}

test.describe('delete a domain', () => {
  test('US4-AS1 the confirmation shows the impact and needs the name typed, in either form and any case', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await startDelete(page, 'gone.example')
    const impact = dialog(page)
    await expect(impact).toContainText('Delete gone.example?')
    await expect(impact).toContainText('alias-of-gone.example')
    await expect(impact).toContainText('Aliases removed: 2')
    await expect(impact).toContainText('reseller, solo')
    await expect(impact.locator('[data-impact="adminsToDelete"]')).toContainText('solo')
    await expect(impact).toContainText('The footer is removed.')
    await expect(impact).toContainText('The tags and the stored mail of the domain are removed.')
    await expect(impact).toContainText('The DKIM key is kept.')
    await impact.getByText('Show the aliases').click()
    await expect(impact).toContainText('sales@gone.example')
    await expect(confirmButton(page)).toBeDisabled()
    await expectAccessible()
    await typed(page).fill('gone')
    await expect(confirmButton(page)).toBeDisabled()
    await typed(page).fill('GONE.example')
    await expect(confirmButton(page)).toBeEnabled()
    await typed(page).fill('gone.example')
    await expect(confirmButton(page)).toBeEnabled()
  })

  test('US4-AS2 a domain with mailboxes or resources offers no deletion and says what must be removed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await page.getByRole('button', { name: 'Actions for busy.example' }).click()
    await expect(page.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByRole('menu', { name: 'Actions for busy.example' })).toContainText(
      'mailboxes (3)',
    )
    await expectAccessible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Actions for things.example' }).click()
    await expect(page.getByRole('menu', { name: 'Actions for things.example' })).toContainText(
      'resources (1)',
    )
  })

  test('US4-AS3 a mailbox added meanwhile: the preview shows the blockers; after confirming, the API refusal shows the counts', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await mockApi.addMailbox('gone.example')
    await startDelete(page, 'gone.example')
    await expect(dialog(page)).toContainText('gone.example cannot be deleted')
    await expect(dialog(page)).toContainText('user1@gone.example')
    await expect(confirmButton(page)).toHaveCount(0)
    await expectAccessible()
    await dialog(page).getByRole('button', { name: 'Close' }).click()

    await mockApi.patch({
      domains: { set: { 'gone.example': { usage: { mailboxes: 0 } as never } } },
    })
    await startDelete(page, 'gone.example')
    await typed(page).fill('gone.example')
    await mockApi.addMailbox('gone.example')
    await confirmButton(page).click()
    await expect(dialog(page)).toContainText('The domain still has 1 mailboxes and 0 resources.')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(entry(page, 'gone.example')).toHaveCount(1)
  })

  test('US4-AS4 FR-043 success returns to the list, announces it, and the deletion carried the preview version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await startDelete(page, 'gone.example')
    await typed(page).fill('gone.example')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/ng\/domains$/)
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Domain gone.example has been removed',
    )
    await listReady(page)
    await expect(entry(page, 'gone.example')).toHaveCount(0)
    const [request] = await deletes(mockApi)
    expect(request!.headers['if-match']).toMatch(/^".+"$/)
  })

  test('FR-041 deleting from the actions of a list entry', async ({ page, mockApi }) => {
    await mockApi.use('domain-delete')
    await page.goto('domains')
    await listReady(page)
    await page.getByRole('button', { name: 'Actions for gone.example' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await typed(page).fill('gone.example')
    await confirmButton(page).click()
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Domain gone.example has been removed',
    )
    await expect(entry(page, 'gone.example')).toHaveCount(0)
    await page.getByRole('button', { name: 'Actions for busy.example' }).click()
    await expect(page.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByRole('menu', { name: 'Actions for busy.example' })).toContainText(
      'mailboxes (3)',
    )
  })

  test('FR-043 an outdated deletion shows the impact again to confirm; a vanished domain leaves the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await startDelete(page, 'gone.example')
    await typed(page).fill('gone.example')
    await mockApi.mutateDomain('gone.example', { description: 'Changed' })
    await confirmButton(page).click()
    await expect(dialog(page)).toContainText('The domain was changed in the meantime.')
    await expect(confirmButton(page)).toBeDisabled()
    await typed(page).fill('gone.example')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/ng\/domains$/)
    expect(await deletes(mockApi)).toHaveLength(2)

    await startDelete(page, 'other.example')
    await typed(page).fill('other.example')
    await mockApi.removeDomain('other.example')
    await confirmButton(page).click()
    await expect(dialog(page)).toContainText('This domain no longer exists.')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/ng\/domains$/)
    await listReady(page)
    await expect(entry(page, 'other.example')).toHaveCount(0)
  })

  test('FR-074 the dialog is labelled, keeps the focus, closes with Escape and returns the focus', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    const trigger = page.getByRole('button', { name: 'Actions for gone.example' })
    await startDelete(page, 'gone.example')
    await expect(dialog(page)).toHaveAccessibleName('Delete gone.example?')
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab')
    expect(await dialog(page).evaluate((element) => element.contains(document.activeElement))).toBe(
      true,
    )
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('FR-002 a domain administrator has no Delete in the list or on the domain page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains')
    await listReady(page)
    await expect(page.getByRole('button', { name: /^Actions for/ })).toHaveCount(0)
    await page.goto('domains/customer-a.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  })

  test('Edge: a temporary failure says nothing was deleted, and the retry deletes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-delete')
    await openList(page)
    await mockApi.failNext('deleteDomain', {
      status: 503,
      type: 'temporary-failure',
      retryAfter: 2,
    })
    await startDelete(page, 'gone.example')
    await typed(page).fill('gone.example')
    await confirmButton(page).click()
    await expect(dialog(page)).toContainText('Nothing was deleted.')
    await dialog(page).getByRole('button', { name: 'Try again' }).click()
    await expect(page).toHaveURL(/\/ng\/domains$/)
    if (isNarrow(page)) await expect(entry(page, 'gone.example')).toHaveCount(0)
  })
})
