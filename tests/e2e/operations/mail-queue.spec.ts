// UI 011 US4 (T088): the Queue Manager — legacy's search, columns, sort and pages, selection mode
// with one request per action and a result per message, delete with the typed count, flush, delete
// all with the count and the acknowledgement, a stopped Postfix, a truncated listing, timeouts and
// refusals, and the list states. Legacy's filters are only its search (plan decision 18).
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768
const entry = (page: Page, id: string) => page.locator(`[data-entry="${id}"]`)
const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

async function open(page: Page, mockApi: MockApi, scenario = 'admin-operations', path = '') {
  await mockApi.use(scenario)
  await page.goto(`operations/mail-queue${path}`)
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
    { timeout: 15_000 },
  )
}

async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

async function select(page: Page, ...ids: string[]) {
  const toggle = page.getByRole('button', { name: 'Select', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  for (const id of ids) await page.getByRole('checkbox', { name: `Select ${id}` }).check()
}

test.describe('Queue Manager @operations', () => {
  test('US4-AS1 SC-002 FR-051 searching for the partner lists its 3 deferred messages with their reasons', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi)
    await expect(page.getByRole('heading', { level: 1, name: 'Queue Manager' })).toBeVisible()
    await expect(page.locator('[data-queue-total]')).toHaveText('8')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('partner.example')
    await expect(page.locator('[data-entry]')).toHaveCount(3)
    await expect(page.locator('[data-entry]').first()).toContainText(
      'carol@partner.example (connect to mx.partner.example[192.0.2.25]:25: Connection timed out)',
    )
    await expect(page).toHaveURL(/q=partner\.example/)
    if (isNarrow(page)) {
      const card = entry(page, '4F2A1B3C9D')
      await expect(card.getByRole('heading', { name: '4F2A1B3C9D' })).toBeVisible()
      await expect(card.locator('summary')).toHaveText('+ 2 more')
    } else {
      await expect(page.getByRole('columnheader', { name: /Arrival time/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('FR-050 FR-053 the legend, the sort, the page size and the search survive a reload', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    const legend = page.locator('[data-queue-legend]')
    await expect(legend).toContainText('Mail queue actions functions:')
    await expect(legend.locator('li')).toHaveText([/^Deliver \| /, /^Unhold \| /, /^Hold \| /])
    if (isNarrow(page)) {
      await page.getByLabel('Sort by').selectOption('size')
      await page.getByLabel('Order').selectOption('desc')
    } else {
      await page.getByRole('button', { name: /^Message size/ }).click()
      await page.getByRole('button', { name: /^Message size/ }).click()
    }
    await expect(page).toHaveURL(/sort=size/)
    await expect(page).toHaveURL(/order=desc/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '4F2A1B3C9D')
    await page.getByLabel(/entries/).selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await page.reload()
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '4F2A1B3C9D')
    await expect(page.getByLabel(/entries/)).toHaveValue('50')
  })

  test('US4-AS2 FR-056 FR-057 Hold sends one request and reports the message delivered meanwhile', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await open(page, mockApi, 'ops-queue-vanishing')
    await select(page, '4F2A1B3C9D', '5B0C2D4E1F', '6C1D3E5F20', '7D2E4F6031')
    await expect(bar(page)).toContainText('4 selected')
    // Cards scrolled under the sticky header or the selection bar would overlap their controls for
    // axe's target size check (as in UI 008's bulk actions). The focus leaves the last checkbox
    // first, so that WebKit does not scroll it back into view while axe runs.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
    const before = await mockApi.mark()
    await bar(page).getByRole('button', { name: 'Hold', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('3 done and 1 not found')
    await expect(results.locator('li', { hasText: '6C1D3E5F20' })).toContainText('Not found')
    await expect(page.locator('[data-queue-status]')).toHaveText(
      'Queue command completed successfully',
    )
    const requests = await requestsOf(mockApi, 'bulkMailQueueMessages')
    expect(requests).toHaveLength(1)
    expect(requests[0]!.body).toEqual({
      action: 'hold',
      targets: [
        { id: '4F2A1B3C9D' },
        { id: '5B0C2D4E1F' },
        { id: '6C1D3E5F20' },
        { id: '7D2E4F6031' },
      ],
    })
    expect(await mockApi.countRequests('listMailQueueMessages', before)).toBeGreaterThan(0)
    await expect(entry(page, '6C1D3E5F20')).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: 'Select 4F2A1B3C9D' })).not.toBeChecked()
    await expectAccessible()
  })

  test('US4-AS3 FR-056 deleting selected messages needs their number typed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await select(page, '8E3F507142', '9F40618253')
    await bar(page).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog.locator('[data-delete-ids] li')).toHaveText(['8E3F507142', '9F40618253'])
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await requestsOf(mockApi, 'bulkMailQueueMessages')).toEqual([])
    await bar(page).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByLabel('Type 2 to confirm').fill('2')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('2 done')
    const [request] = await requestsOf(mockApi, 'bulkMailQueueMessages')
    expect(request!.body).toMatchObject({ action: 'delete' })
    await expect(entry(page, '8E3F507142')).toHaveCount(0)
  })

  test('FR-056 deliver and unhold are sent without a confirmation', async ({ page, mockApi }) => {
    await open(page, mockApi)
    await select(page, '8E3F507142')
    await bar(page).getByRole('button', { name: 'Unhold' }).click()
    await expect(page.locator('[data-queue-status]')).toBeVisible()
    await select(page, '5B0C2D4E1F')
    await bar(page).getByRole('button', { name: 'Deliver' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
    const actions = (await requestsOf(mockApi, 'bulkMailQueueMessages')).map(
      (request) => (request.body as { action: string }).action,
    )
    expect(actions).toEqual(['release', 'deliver'])
  })

  test('FR-054 the selection clears when the page or the search changes', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await select(page, '4F2A1B3C9D')
    await expect(bar(page)).toContainText('1 selected')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('partner')
    await expect(page.locator('[data-entry]')).toHaveCount(3)
    await expect(bar(page)).toContainText('0 selected')
  })

  test('US4-AS5 FR-058 Flush sends no confirmation and refreshes the list', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    const before = await mockApi.mark()
    await page.getByRole('button', { name: 'Flush queue' }).click()
    await expect(page.locator('[data-queue-status]')).toHaveText(
      'Queue command completed successfully',
    )
    expect(await requestsOf(mockApi, 'flushMailQueue')).toHaveLength(1)
    await expect
      .poll(() => mockApi.countRequests('listMailQueueMessages', before))
      .toBeGreaterThan(0)
    await expectAccessible()
  })

  test('US4-AS6 SC-007 FR-058 Delete all states the count and needs it typed and acknowledged', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await open(page, mockApi)
    await page.getByRole('button', { name: 'Delete all' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(
      'Please confirm you want to delete all items from the current queue.',
    )
    await expect(dialog).toContainText('8 messages are queued, including held ones.')
    const remove = dialog.getByRole('button', { name: 'Delete now' })
    await expect(remove).toBeDisabled()
    await dialog.getByLabel('Type 8 to confirm').fill('8')
    await expect(remove).toBeDisabled()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await dialog
      .getByLabel(
        'I understand that all queued messages, including held ones, are deleted permanently',
      )
      .check()
    expect(await requestsOf(mockApi, 'purgeMailQueue')).toEqual([])
    await remove.click()
    await expect(page.locator('[data-queue-status]')).toBeVisible()
    expect(await requestsOf(mockApi, 'purgeMailQueue')).toHaveLength(1)
    await expect(page.locator('[data-empty]')).toHaveText('No data available in table')
  })

  test('US4-AS7 FR-060 a stopped Postfix is named with a link to its card', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await open(page, mockApi, 'ops-queue-postfix-stopped')
    const notice = page.locator('[data-postfix-stopped]')
    await expect(notice).toContainText('The Postfix container postfix-mailcow is not running.')
    await expect(
      notice.getByRole('link', { name: 'Show postfix-mailcow on the dashboard' }),
    ).toHaveAttribute('href', '/ng/operations/containers/postfix-mailcow')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US4-AS8 FR-052 a truncated listing says that only the first 10,000 are listed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-queue-large')
    await expect(page.locator('[data-queue-total]')).toHaveText('12,000')
    await expect(page.locator('[data-queue-truncated]')).toContainText(
      'Only the first 10,000 messages are listed. Flushing the queue and deleting all messages affect every queued message.',
    )
    await expectAccessible()
  })

  test('FR-059 SC-006 a timeout is "outcome unknown", refreshes the list and is not repeated', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-queue-timeout')
    await select(page, '4F2A1B3C9D')
    const before = await mockApi.mark()
    await bar(page).getByRole('button', { name: 'Hold', exact: true }).click()
    await expect(page.locator('[data-queue-unknown]')).toContainText('Outcome unknown')
    await expect(page.locator('[data-queue-unknown]')).toContainText(
      'It is unknown whether the action was completed.',
    )
    await expect
      .poll(() => mockApi.countRequests('listMailQueueMessages', before))
      .toBeGreaterThan(0)
    expect(await requestsOf(mockApi, 'bulkMailQueueMessages')).toHaveLength(1)
    await expectAccessible()
  })

  test('FR-059 a lost connection is "outcome unknown" and never retried', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await page.route('**/api/v2/mail-queue/flush', (route) => route.abort())
    await page.getByRole('button', { name: 'Flush queue' }).click()
    await expect(page.locator('[data-queue-unknown]')).toContainText('Outcome unknown')
    expect(await requestsOf(mockApi, 'flushMailQueue')).toEqual([])
  })

  test("FR-059 a refused action shows Postfix's message", async ({ page, mockApi }) => {
    await open(page, mockApi, 'ops-queue-failure')
    await select(page, '4F2A1B3C9D')
    await bar(page).getByRole('button', { name: 'Hold', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Error:' })).toContainText(
      'Error: postsuper: fatal: queue file is locked',
    )
  })

  test('FR-016 FR-076 an action without an audit record says so', async ({ page, mockApi }) => {
    await open(page, mockApi)
    await mockApi.patch({
      operations: { inject: { flushMailQueue: { auditRecorded: false } } },
    })
    await page.getByRole('button', { name: 'Flush queue' }).click()
    await expect(page.locator('[data-not-recorded]')).toHaveText(
      'The action was carried out, but no audit record was written.',
    )
  })

  test('FR-062 the empty queue, no matching messages, an error with retry, and no automatic refresh', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await page.clock.install()
    await open(page, mockApi, 'ops-queue-empty')
    await expect(page.locator('[data-empty]')).toHaveText('No data available in table')
    await expectAccessible()
    const before = await mockApi.mark()
    await page.clock.runFor(120_000)
    expect(await mockApi.countRequests('listMailQueueMessages', before)).toBe(0)

    await open(page, mockApi)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('no-such-sender')
    await expect(page.getByRole('main').getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).last().click()
    await expect(page.locator('[data-entry]')).toHaveCount(8)

    await mockApi.use('admin-operations', {
      operations: { inject: { listMailQueueMessages: { status: 503, times: 1 } } },
    })
    await page.goto('operations/mail-queue')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await expectAccessible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-entry]')).toHaveCount(8)
  })
})
