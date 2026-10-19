// UI 004 US3, deleting an alias from the list (T052): only the list offers it, as legacy does
// (docs/conventions.md "Detail pages"). The confirmation uses legacy's `#ConfirmDeleteModal` texts
// with the address and the consequences; focus starts on Cancel and returns to the menu trigger;
// the outcome is legacy's alert. An outdated deletion confirms again; a vanished alias is reported.
import { ALIAS_004 } from '../../mocks/scenarios/feature-004-base'
import { EDIT_ALIAS_004 } from '../../mocks/scenarios/aliases-edit'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { entry, isNarrow, listReady } from './helpers'

type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}
const deletions = async (mockApi: Requests) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'deleteAlias')

const trigger = (page: Page, id: number) =>
  entry(page, id).getByRole('button', { name: /^Actions for/ })

async function openRemove(page: Page, id: number) {
  await trigger(page, id).click()
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  return page.getByRole('alertdialog')
}

test.describe('alias list: deletion', () => {
  test('US3-AS5 FR-029 FR-030 the confirmation names the address and the consequences, and the alias leaves the list', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const box = await trigger(page, EDIT_ALIAS_004.sales).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)

    let dialog = await openRemove(page, EDIT_ALIAS_004.sales)
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText('sales@example.org')
    await expect(dialog).toContainText('Mail to this address is no longer accepted')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(trigger(page, EDIT_ALIAS_004.sales)).toBeFocused()
    expect(await deletions(mockApi)).toHaveLength(0)

    dialog = await openRemove(page, EDIT_ALIAS_004.sales)
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      'Alias sales@example.org has been removed',
    )
    await expect(entry(page, EDIT_ALIAS_004.sales)).toHaveCount(0)
    const [request] = await deletions(mockApi)
    expect(request!.headers['if-match']).toBeTruthy()
  })

  test('FR-029 a catch-all alias adds the domain-wide permissions to the consequences', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const dialog = await openRemove(page, EDIT_ALIAS_004.catchAll)
    await expect(dialog).toContainText('@example.org')
    await expect(dialog).toContainText('catch-all')
    await expect(dialog).toContainText('example.org')
  })

  test('FR-015 the menu offers Edit, which opens the section, on cards and table rows', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    if (isNarrow(page)) await expect(entry(page, ALIAS_004.sales).locator('article')).toBeVisible()
    else await expect(page.locator('table')).toBeVisible()
    await trigger(page, ALIAS_004.sales).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page).toHaveURL(new RegExp(`/aliases/${ALIAS_004.sales}\\?edit=alias$`))
    await expect(
      page.locator('#section-alias').getByRole('textbox', { name: 'Edit alias', exact: true }),
    ).toBeVisible()
  })

  test('FR-027 a deletion refused as outdated confirms again with the reloaded alias', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const dialog = await openRemove(page, EDIT_ALIAS_004.sales)
    await mockApi.patch({
      changeElsewhere: { alias: { [EDIT_ALIAS_004.sales]: { address: 'team@example.org' } } },
    })
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog).toContainText('The alias changed in the meantime')
    await expect(dialog).toContainText('team@example.org')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      'Alias team@example.org has been removed',
    )
    const [first, second] = await deletions(mockApi)
    expect(second!.headers['if-match']).not.toBe(first!.headers['if-match'])
  })

  test('FR-028 an alias deleted elsewhere is reported', async ({ page, mockApi }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const dialog = await openRemove(page, EDIT_ALIAS_004.sales)
    await mockApi.patch({ deleteElsewhere: { alias: [EDIT_ALIAS_004.sales] } })
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="danger"]')).toHaveText(
      'This alias no longer exists or is no longer available to you.',
    )
    await expect(entry(page, EDIT_ALIAS_004.sales)).toHaveCount(0)
  })

  test('US3-AS7 an orphaned alias can be deleted from the list', async ({ page, mockApi }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    const dialog = await openRemove(page, EDIT_ALIAS_004.orphaned)
    await expect(dialog).toContainText('lost@gone.example')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      'Alias lost@gone.example has been removed',
    )
    await expect(entry(page, EDIT_ALIAS_004.orphaned)).toHaveCount(0)
  })

  test('the alias page offers no deletion, as legacy', async ({ page, mockApi }) => {
    await mockApi.use('aliases-edit')
    await page.goto(`aliases/${EDIT_ALIAS_004.sales}`)
    await expect(page.locator('#section-alias')).toBeVisible()
    await expect(page.getByRole('button', { name: /Remove|Delete/ })).toHaveCount(0)
  })
})
