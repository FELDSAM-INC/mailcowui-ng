// UI 003 US6, mass actions on mailboxes (T096): selection mode at every width, legacy's "Mailbox"
// and "Allowed protocols" menus, confirmations (none to activate, one to take away, the count typed
// to delete), the per-item results with retry, the bulk limit, the selection cleared by list
// changes, the protocol gate of domain administrators and a lost connection.
import type { Page } from '@playwright/test'

import { entry, isNarrow, listReady } from '../domains/helpers'
import { expect, test } from '../fixtures/test'

interface Recorded {
  operationId: string | null
  body?: unknown
  status: number
}

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })
const results = (page: Page) => page.getByRole('region', { name: 'Results' })
const dialog = (page: Page) => page.getByRole('alertdialog')

async function open(page: Page, query = '') {
  await page.goto(`mailboxes${query}`)
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

async function select(page: Page, addresses: string[]) {
  for (const address of addresses) {
    await page.getByRole('checkbox', { name: `Select ${address}` }).check()
  }
}

async function choose(page: Page, menu: 'Mailbox' | 'Allowed protocols', item: string) {
  await bar(page).getByRole('button', { name: menu }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

async function bulkRequests(mockApi: { requests(): Promise<Recorded[]> }) {
  return (await mockApi.requests()).filter((r) => r.operationId === 'applyMailboxBulkAction')
}

const box = (n: number) => `box${String(n).padStart(3, '0')}@bulk.example`

test.describe('mailbox mass actions', () => {
  test('US6-AS1 FR-055 select all 25 on the page and deactivate: confirmed once, all done, shown inactive', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await expect(bar(page)).toContainText('25 selected')
    await choose(page, 'Mailbox', 'Deactivate')
    await expect(dialog(page)).toContainText('Deactivate the selected mailboxes (25)?')
    await expect(dialog(page)).toContainText(box(1))
    await expectAccessible()
    await dialog(page).getByRole('button', { name: 'Deactivate' }).click()
    await expect(results(page).locator('li')).toHaveCount(25)
    await expect(results(page)).toContainText('24 done')
    await expect(results(page)).toContainText('1 failed')
    await expect(entry(page, box(1))).toContainText('Inactive')
    await expect(bar(page)).toContainText('1 selected')
  })

  test('US6-AS2 FR-056 two deleted elsewhere are not found; an outdated one is retried with its new version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1), box(2), box(4), box(5)])
    await mockApi.patch({
      mailboxes: { remove: [box(1), box(2)], set: { [box(4)]: { displayName: 'Changed' } } },
    })
    await choose(page, 'Mailbox', 'Activate')
    await expect(results(page)).toContainText('2 not found')
    await expect(results(page)).toContainText('1 changed in the meantime')
    await expect(results(page)).toContainText('1 done')
    await expect(bar(page)).toContainText('1 selected')
    await results(page).getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results(page)).toContainText('1 done')
    const [first, second] = await bulkRequests(mockApi)
    expect((first?.body as { targets: unknown[] }).targets).toHaveLength(4)
    expect((second?.body as { targets: { id: string }[] }).targets.map((t) => t.id)).toEqual([
      box(4),
    ])
  })

  test('US6-AS3 FR-054 the next page and a new search clear the selection', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1), box(2)])
    await expect(bar(page)).toContainText('2 selected')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(bar(page)).toContainText('0 selected')
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await select(page, [box(1)])
    await page.getByRole('searchbox', { name: 'Search:' }).fill('box00')
    await expect(page).toHaveURL(/q=box00/)
    await expect(bar(page)).toContainText('0 selected')
  })

  test('US6-AS4 a domain administrator without protocol access has no protocol actions', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-no-protocol')
    await open(page)
    await select(page, [box(1)])
    await expect(bar(page).getByRole('button', { name: 'Mailbox' })).toBeVisible()
    await expect(bar(page).getByRole('button', { name: 'Allowed protocols' })).toHaveCount(0)
  })

  test('US6-AS5 deleting needs the count typed; the failed one stays listed and selected', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1), box(2), box(3)])
    await choose(page, 'Mailbox', 'Remove')
    await expect(dialog(page)).toContainText('Confirm deletion')
    await expect(dialog(page)).toContainText(box(3))
    const confirmButton = dialog(page).getByRole('button', { name: 'Delete now' })
    await expect(confirmButton).toBeDisabled()
    await dialog(page).getByLabel('Type 3 to confirm').fill('3')
    await confirmButton.click()
    await expect(results(page)).toContainText('2 done')
    await expect(results(page)).toContainText('1 failed')
    await expect(results(page)).toContainText('temporarily unavailable')
    await expect(entry(page, box(3))).toBeVisible()
    await expect(entry(page, box(1))).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: `Select ${box(3)}` })).toBeChecked()
  })

  test('FR-053 the protocol actions: disallow IMAP is confirmed, allow is not', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1)])
    await bar(page).getByRole('button', { name: 'Allowed protocols' }).click()
    await page.getByRole('menuitem', { name: 'Deactivate IMAP', exact: true }).click()
    await expect(dialog(page)).toContainText('Disallow IMAP for the selected mailboxes (1)?')
    await dialog(page).getByRole('button', { name: 'Deactivate' }).click()
    await expect(results(page)).toContainText('1 done')
    await select(page, [box(1)])
    await bar(page).getByRole('button', { name: 'Allowed protocols' }).click()
    await page.getByRole('menuitem', { name: 'Activate IMAP', exact: true }).click()
    await expect(results(page)).toContainText('1 done')
    const requests = await bulkRequests(mockApi)
    expect(requests.map((r) => r.body)).toMatchObject([
      { action: 'disallowProtocol', protocol: 'imap' },
      { action: 'allowProtocol', protocol: 'imap' },
    ])
  })

  test('FR-054 with a bulk limit of 20, "Toggle all" selects the first 20 and says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-bulk-limit-20')
    await open(page)
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await expect(bar(page)).toContainText('20 selected')
    await expect(bar(page)).toContainText('You can select at most 20 items for one action.')
    await expect(page.getByRole('checkbox', { name: `Select ${box(21)}` })).toBeDisabled()
  })

  test('US6-AS6 FR-057 at phone width: selection mode, 44 px checkboxes and the bar at the bottom', async ({
    page,
    mockApi,
    expectTouchTargets,
  }) => {
    test.skip(!isNarrow(page), 'phone width')
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1)])
    const box1 = await page.getByRole('checkbox', { name: `Select ${box(1)}` }).boundingBox()
    expect(box1!.width).toBeGreaterThanOrEqual(20)
    await expectTouchTargets()
    const barBox = await bar(page).boundingBox()
    const viewport = page.viewportSize()!
    expect(Math.round(barBox!.y + barBox!.height)).toBeLessThanOrEqual(viewport.height)
  })

  test('FR-056 a lost connection is "outcome unknown", the list is refreshed and one request was sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-bulk')
    await open(page)
    await select(page, [box(1)])
    await page.route('**/api/v2/mailboxes/bulk-actions', (route) => route.abort())
    await choose(page, 'Mailbox', 'Activate')
    await expect(results(page)).toContainText('1 with unknown outcome')
    await expect(bar(page)).toContainText('0 selected')
  })

  test('FR-066 a double click on the confirmation sends one request', async ({ page, mockApi }) => {
    await mockApi.use('admin-bulk', { delays: { applyMailboxBulkAction: 800 } })
    await open(page)
    await select(page, [box(1)])
    await choose(page, 'Mailbox', 'Deactivate')
    await dialog(page).getByRole('button', { name: 'Deactivate' }).dblclick()
    await expect(results(page)).toContainText('1 done')
    expect(await bulkRequests(mockApi)).toHaveLength(1)
  })

  test('SC-007 100 mailboxes at size 100: 100 results whose counts equal the summary', async ({
    page,
    mockApi,
  }) => {
    test.skip(isNarrow(page), 'a long list; the desktop run covers it')
    await mockApi.use('admin-bulk-100')
    await open(page, '?size=100')
    await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
    await expect(bar(page)).toContainText('100 selected')
    await choose(page, 'Mailbox', 'Activate')
    await expect(results(page).locator('li')).toHaveCount(100)
    await expect(results(page)).toContainText('100 done')
  })
})
