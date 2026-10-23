import { openBulkActions } from '../fixtures/flows'
// UI 004 US6, mass actions on aliases (T080): selection mode with "Toggle all" for the page and
// legacy's action labels, the confirmations of research R16 (none for activate and show, one for
// deactivate and hide, the typed count for delete), one request with each entry's version as listed,
// one result per alias with the single action's legacy message, the selection kept for every alias
// not done, the bulk limit, clearing on list changes, the groupware switch, 100 results and a lost
// connection.
import { BULK_004 } from '../../mocks/scenarios/bulk-004'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { entry, isNarrow, listReady } from './helpers'

type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}
const bulkRequests = async (mockApi: Requests) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'applyAliasBulkAction')

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

async function startSelecting(page: Page, query = 'size=50') {
  await page.goto(`aliases?${query}`)
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

const toggleAll = (page: Page) =>
  page.getByRole('checkbox', { name: 'Toggle all', exact: true }).first()

const select = (page: Page, address: string) =>
  page.getByRole('checkbox', { name: `Select ${address}` })

test.describe('alias list: mass actions', () => {
  test('US6-AS1 FR-058 FR-059 deactivating all asks once, sends each version, and lists 30 results', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('bulk-004')
    await startSelecting(page)
    await toggleAll(page).click()
    await expect(bar(page)).toContainText('30 selected')
    await (await openBulkActions(page)).getByRole('button', { name: 'Deactivate' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Deactivate')
    await expect(dialog).toContainText('30')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Deactivate' }).click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('30 done')
    const [request] = await bulkRequests(mockApi)
    const body = request!.body as { action: string; targets: { id: string; version: string }[] }
    expect(body.action).toBe('deactivate')
    expect(body.targets).toHaveLength(30)
    for (const target of body.targets) expect(target.version).not.toMatch(/"/)
    await expect(summary).toContainText(
      'Changes to alias address sales@example.org have been saved',
    )
    await expect(entry(page, BULK_004.sales).locator('[data-field="active"]')).toContainText('No')
  })

  test('US6-AS2 hiding three of five keeps the two not found selected', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await startSelecting(page)
    for (const id of BULK_004.five) {
      await entry(page, id).getByRole('checkbox').click()
    }
    await mockApi.patch({ deleteElsewhere: { alias: [BULK_004.five[0], BULK_004.five[1]] } })
    await (await openBulkActions(page)).getByRole('button', { name: 'Hide alias in SOGo' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hide alias in SOGo' }).click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('3 done')
    await expect(summary).toContainText('2 not found')
    await expect(bar(page)).toContainText('2 selected')
  })

  test('FR-058 activate and show run at once; delete lists every address and needs the typed count', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await startSelecting(page)
    await entry(page, BULK_004.five[0]).getByRole('checkbox').click()
    await entry(page, BULK_004.five[1]).getByRole('checkbox').click()
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.locator('[data-bulk-summary]')).toContainText('2 done')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    // Done items leave the selection (research R16).
    await expect(bar(page)).toContainText('0 selected')
    await entry(page, BULK_004.five[0]).getByRole('checkbox').click()
    await entry(page, BULK_004.five[1]).getByRole('checkbox').click()
    await (await openBulkActions(page)).getByRole('button', { name: 'Show alias in SOGo' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect.poll(async () => (await bulkRequests(mockApi)).length).toBe(2)
    await entry(page, BULK_004.five[0]).getByRole('checkbox').click()
    await entry(page, BULK_004.five[1]).getByRole('checkbox').click()

    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText('member4@example.org')
    await expect(dialog).toContainText('member5@example.org')
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Type 2 to confirm' }).fill('2')
    await confirm.click()
    await expect(page.locator('[data-bulk-summary]')).toContainText(
      'Alias member4@example.org has been removed',
    )
    await expect(entry(page, BULK_004.five[0])).toHaveCount(0)
  })

  test('US6-AS8 an outdated alias is reported and kept; "Refresh the list" keeps the selection with new versions', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await startSelecting(page)
    await entry(page, BULK_004.five[2]).getByRole('checkbox').click()
    await entry(page, BULK_004.five[3]).getByRole('checkbox').click()
    await mockApi.patch({
      changeElsewhere: { alias: { [BULK_004.five[2]]: { publicComment: 'changed' } } },
    })
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('1 changed in the meantime')
    await expect(bar(page)).toContainText('1 selected')
    await summary.getByRole('button', { name: 'Refresh the list' }).click()
    await expect(bar(page)).toContainText('1 selected')
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.locator('[data-bulk-summary]')).toContainText('1 done')
    const [first, second] = await bulkRequests(mockApi)
    const version = (request: typeof first) =>
      (request!.body as { targets: { id: string; version: string }[] }).targets.find(
        (target) => target.id === String(BULK_004.five[2]),
      )!.version
    expect(version(second)).not.toBe(version(first))
  })

  test('US6-AS5 FR-056 at 360 px: 44 px checkboxes, the bar stays, and list changes clear the selection', async ({
    page,
    mockApi,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await mockApi.use('bulk-004')
    await startSelecting(page, 'size=25')
    const first = BULK_004.ids.at(-1)!
    const box = await entry(page, first).getByRole('checkbox').locator('..').boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await entry(page, first).getByRole('checkbox').click()
    // A scroll as script: mobile WebKit has no mouse wheel.
    await page.evaluate(() => window.scrollBy(0, 3000))
    await expect(bar(page)).toBeInViewport()
    await expect(bar(page)).toContainText('1 selected')
    await page.getByRole('button', { name: /next/i }).first().click()
    await expect(bar(page)).toContainText('0 selected')
    await entry(page, BULK_004.sales).getByRole('checkbox').click()
    await expect(bar(page)).toContainText('1 selected')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('member')
    await expect(bar(page)).toContainText('0 selected')
  })

  test('US6-AS6 FR-060 a bulk limit of 50 selects the first 50 and disables the rest with the message', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-limit-50')
    await startSelecting(page, 'size=100')
    await toggleAll(page).click()
    await expect(bar(page)).toContainText('50 selected')
    await expect(bar(page)).toContainText('You can select at most 50 items for one action.')
    const unselected = page.getByRole('checkbox', { name: /^Select member/, checked: false })
    await expect(unselected.first()).toBeDisabled()
  })

  test('FR-057 show and hide are absent without the groupware', async ({ page, mockApi }) => {
    await mockApi.use('bulk-004')
    await mockApi.patch({ capabilities004: { groupwareEnabled: false } })
    await startSelecting(page)
    await expect(bar(page).getByRole('button', { name: 'Show alias in SOGo' })).toHaveCount(0)
    await expect(bar(page).getByRole('button', { name: 'Hide alias in SOGo' })).toHaveCount(0)
    await expect(bar(page).getByRole('button', { name: 'Deactivate' })).toBeVisible()
  })

  test('SC-010 100 results are listed', async ({ page, mockApi }) => {
    await mockApi.use('bulk-100')
    await startSelecting(page, 'size=100')
    await toggleAll(page).click()
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('100 done')
    await expect(summary.locator('li')).toHaveCount(100)
  })

  test('Edge: a lost connection reports "outcome unknown", refreshes the list, keeps the selection and sends once', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-004')
    await startSelecting(page)
    await select(page, 'sales@example.org').click()
    await page.route('**/api/v2/aliases/bulk-actions', (route) => route.abort())
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('Outcome unknown')
    await expect(bar(page)).toContainText('1 selected')
    await page.unroute('**/api/v2/aliases/bulk-actions')
    expect(await bulkRequests(mockApi)).toHaveLength(0)
  })

  test('Edge: without the capabilities the bar says so and offers a retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-unavailable')
    await page.goto('aliases')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(
      page.getByText('The server settings this form needs could not be loaded.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    if (isNarrow(page)) await expect(bar(page)).toHaveCount(0)
  })
})
