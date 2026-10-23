import { openBulkActions } from '../fixtures/flows'
// UI 004 US6, "Expand alias over alias domains" (T081): a list row action and a mass action, as in
// legacy (plan part 3, item 8: not on the alias page). The explanation comes first; each alias
// domain's outcome is legacy's message, the created copy linked; an alias in an alias domain or an
// orphaned alias offers no copy; a domain without alias domains creates nothing; an outdated copy
// explains again.
import { BULK_004 } from '../../mocks/scenarios/bulk-004'
import { EDIT_ALIAS_004 } from '../../mocks/scenarios/aliases-edit'
import { ALIAS_004 } from '../../mocks/scenarios/feature-004-base'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { entry, listReady } from './helpers'

type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}
const copies = async (mockApi: Requests) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'copyAliasOverAliasDomains')

async function openMenu(page: Page, id: number) {
  await entry(page, id)
    .getByRole('button', { name: /^Actions for/ })
    .click()
}

test.describe('alias list: expand over alias domains', () => {
  test('US6-AS4 the explanation first, then the created copy linked and the skipped one with its reason', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('bulk-004')
    await page.goto('aliases?size=50')
    await listReady(page)
    await openMenu(page, BULK_004.sales)
    await page.getByRole('menuitem', { name: 'Expand alias over alias domains' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('alias domain')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Expand alias over alias domains' }).click()
    const report = page.locator('[data-copy-results]')
    await expect(report.getByRole('link', { name: /sales@example\.com/ })).toBeVisible()
    await expect(report).toContainText(
      'sales@example.net is already known as an alias, a mailbox or an alias address expanded from an alias domain.',
    )
    const [request] = await copies(mockApi)
    expect(request!.headers['if-match']).toBeTruthy()
  })

  test('FR-031 no copy for an alias in an alias domain or an orphaned alias', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await page.goto('aliases?size=50')
    await listReady(page)
    await openMenu(page, BULK_004.inAliasDomain)
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Expand alias over alias domains' }),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    await openMenu(page, EDIT_ALIAS_004.orphaned)
    await expect(
      page.getByRole('menuitem', { name: 'Expand alias over alias domains' }),
    ).toHaveCount(0)
  })

  test('FR-032 a domain without alias domains says nothing was created', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto('aliases')
    await listReady(page)
    await openMenu(page, ALIAS_004.contact)
    await page.getByRole('menuitem', { name: 'Expand alias over alias domains' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Expand alias over alias domains' })
      .click()
    await expect(page.locator('[data-copy-results]')).toContainText(
      'This domain has no alias domains, so nothing was created.',
    )
  })

  test('a copy refused as outdated reloads and explains again', async ({ page, mockApi }) => {
    await mockApi.use('bulk-004')
    await page.goto('aliases?size=50')
    await listReady(page)
    await openMenu(page, BULK_004.sales)
    await page.getByRole('menuitem', { name: 'Expand alias over alias domains' }).click()
    await mockApi.patch({ changeElsewhere: { alias: { [BULK_004.sales]: { internal: true } } } })
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Expand alias over alias domains' }).click()
    await expect(dialog).toContainText('The alias changed in the meantime')
    await dialog.getByRole('button', { name: 'Expand alias over alias domains' }).click()
    await expect(page.locator('[data-copy-results]')).toBeVisible()
    expect(await copies(mockApi)).toHaveLength(2)
  })

  test('bulk copy lists each alias with its copies, and an alias in an alias domain is refused', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await page.goto('aliases?size=50')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, BULK_004.sales).getByRole('checkbox').click()
    await entry(page, BULK_004.inAliasDomain).getByRole('checkbox').click()
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Expand alias over alias domains' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Expand alias over alias domains' })
      .click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('1 done')
    await expect(summary).toContainText('1 refused')
    await expect(summary).toContainText('Skipped non-primary alias info@example.net')
    await expect(summary.getByRole('link', { name: /sales@example\.com/ })).toBeVisible()
  })
})
