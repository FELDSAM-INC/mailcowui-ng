// UI 002 US5, acting on several domains at once (T072): selection mode, the API's bulk operation
// with version tags, confirmations, progress, per-domain results, retry and the edge cases.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entryNames, isMobile, isNarrow, listReady } from './helpers'

interface Recorded {
  operationId: string | null
  body?: unknown
  status: number
}
type Target = { id: string; version?: string }

async function select(page: Page, names: string[]) {
  for (const name of names) await page.getByRole('checkbox', { name: `Select ${name}` }).check()
}

async function startSelecting(page: Page) {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })
const results = (page: Page) => page.getByRole('region', { name: 'Results' })
const dialog = (page: Page) => page.getByRole('alertdialog')

async function bulkRequests(mockApi: { requests(): Promise<Recorded[]> }) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'applyDomainBulkAction' && request.status !== 403,
  )
}

const targetsOf = (request: Recorded) => (request.body as { targets: Target[] }).targets

const FIRST_TEN = Array.from(
  { length: 10 },
  (_, i) => `bulk-${String(i + 1).padStart(2, '0')}.example`,
)

test.describe('bulk actions', () => {
  test('US5-AS1 US5-AS2 deactivating 10 shows progress and a result per domain; retry sends only the 2 failed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    // Two accessibility scans in both themes, a delayed request and a retry.
    test.slow()
    await mockApi.use('bulk-mixed', { delays: { applyDomainBulkAction: 800 } })
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await select(page, FIRST_TEN)
    await expect(bar(page)).toContainText('10 selected')
    await bar(page).getByRole('button', { name: 'Deactivate' }).click()
    await expect(dialog(page)).toContainText('bulk-01.example')
    await expect(dialog(page)).toContainText('can no longer sign in')
    await expectAccessible()
    await dialog(page).getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.locator('[data-bulk-progress]')).toContainText('Processing 10 domains')
    await expect(results(page).locator('li')).toHaveCount(10)
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(8)
    const failed = results(page).locator('li', { hasText: 'Failed' })
    await expect(failed).toHaveCount(2)
    await expect(failed.first()).toContainText('temporarily unavailable')
    await expect(page.locator('[data-live="polite"]')).toContainText('8 done')
    await expectAccessible()
    await expect(bar(page)).toContainText('2 selected')
    await results(page).getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results(page).locator('li')).toHaveCount(2)
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(2)
    const [first, retry] = await bulkRequests(mockApi)
    expect(targetsOf(first!).map((t) => t.id)).toEqual(FIRST_TEN)
    expect(targetsOf(retry!).map((t) => t.id)).toEqual(['bulk-03.example', 'bulk-07.example'])
  })

  test('US5-AS3 FR-047 a bulk deletion lists the deletable domains with their impact, skips those with mailboxes or resources, and needs the count typed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('bulk-mixed')
    await page.goto('domains?size=50')
    await listReady(page)
    await startSelecting(page)
    await select(page, [
      'bulk-26.example',
      'bulk-27.example',
      'bulk-28.example',
      'busy.example',
      'things.example',
    ])
    await bar(page).getByRole('button', { name: 'Delete' }).click()
    const impact = dialog(page)
    await expect(impact).toContainText('Delete the selected domains (3)?')
    await expect(impact.locator('[data-bulk-impact="bulk-26.example"]')).toContainText(
      'alias domains: 1',
    )
    await expect(impact.locator('[data-bulk-impact="bulk-26.example"]')).toContainText('reseller')
    await expect(impact.locator('[data-bulk-skipped]')).toContainText('busy.example')
    await expect(impact.locator('[data-bulk-skipped]')).toContainText('things.example')
    await expect(impact).toContainText('left without any domain are deleted')
    const confirm = impact.getByRole('button', { name: 'Delete domains' })
    await expect(confirm).toBeDisabled()
    await expectAccessible()
    await impact.getByRole('textbox').fill('5')
    await expect(confirm).toBeDisabled()
    await impact.getByRole('textbox').fill('3')
    await confirm.click()
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(3)
    await expect(results(page).locator('li', { hasText: 'Skipped' })).toHaveCount(2)
    const [request] = await bulkRequests(mockApi)
    expect(targetsOf(request!).map((t) => t.id)).toEqual([
      'bulk-26.example',
      'bulk-27.example',
      'bulk-28.example',
    ])
  })

  test('US5-AS4 on a phone, selection mode shows 44 px checkboxes and a bar naming the count', async ({
    page,
    mockApi,
    expectTouchTargets,
    expectNoHorizontalScroll,
  }) => {
    test.skip(!isNarrow(page), 'the phone layout')
    await mockApi.use('bulk-mixed')
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await select(page, ['bulk-01.example', 'bulk-02.example', 'bulk-03.example'])
    await expect(bar(page)).toContainText('3 selected')
    await expectTouchTargets()
    await expectNoHorizontalScroll()
  })

  test('FR-045 select all on the page; changes of page, search, filter, sort or size clear the selection; activation needs no confirmation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-mixed')
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    const selectAll = page.getByRole('checkbox', { name: 'Select all on this page' })
    await selectAll.check()
    await expect(bar(page)).toContainText('25 selected')
    for (const change of [
      () => page.getByRole('button', { name: 'Next', exact: true }).click(),
      () => page.getByRole('searchbox', { name: 'Search domains' }).fill('bulk'),
      () => page.getByLabel('Sort by').selectOption('createdAt'),
      () => page.locator('[data-page-size] select').selectOption('50'),
    ]) {
      await page.getByRole('checkbox', { name: 'Select all on this page' }).check()
      await expect(bar(page)).not.toContainText('0 selected')
      await change()
      await expect(bar(page)).toContainText('0 selected')
    }
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await select(page, ['bulk-01.example'])
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(1)
  })

  test('FR-046 targets carry their version; an outdated item stays selected and its retry carries the new version; a lost connection reports unknown outcomes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-limit-small')
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await select(page, ['bulk-01.example', 'bulk-02.example'])
    await mockApi.mutateDomain('bulk-02.example', { description: 'Changed elsewhere' })
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    const outdated = results(page).locator('li', { hasText: 'Changed in the meantime' })
    await expect(outdated).toHaveCount(1)
    await expect(outdated).toContainText('bulk-02.example')
    await expect(bar(page)).toContainText('1 selected')
    await results(page).getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(1)
    const [first, retry] = await bulkRequests(mockApi)
    // G33: each version is the list entry's etag exactly as read, quotes included.
    for (const target of targetsOf(first!)) expect(target.version).toMatch(/^"[^"]+"$/)
    expect(targetsOf(retry!)[0]!.version).not.toBe(targetsOf(first!)[1]!.version)

    await results(page).getByRole('button', { name: 'Close' }).click()
    await select(page, ['bulk-04.example', 'bulk-05.example'])
    await page.route('**/api/v2/domains/bulk-actions', (route) => route.abort())
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(results(page).locator('li', { hasText: 'Outcome unknown' })).toHaveCount(2)
    await expect(bar(page)).toContainText('0 selected')
    await expect(results(page).getByRole('button', { name: 'Retry the failed ones' })).toHaveCount(
      0,
    )
  })

  test('FR-048 leaving during a running action warns that its result will not be shown', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-mixed', { delays: { applyDomainBulkAction: 4000 } })
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await select(page, ['bulk-01.example'])
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.locator('[data-bulk-progress]')).toBeVisible()
    if (isMobile(page)) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click()
      await page.getByRole('dialog').getByRole('link', { name: 'Mailboxes' }).click()
    } else {
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Mailboxes' })
        .click()
    }
    await expect(dialog(page)).toContainText('its result will not be shown')
    await dialog(page).getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/\/ng\/domains/)
    await expect(results(page)).toBeVisible({ timeout: 10_000 })
  })

  test('Edge: at a bulk limit of 20, "select all" takes the first 20 and states the limit; the rest is disabled', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('bulk-limit-small')
    await page.goto('domains')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: 'Select all on this page' }).check()
    await expect(bar(page)).toContainText('20 selected')
    await expect(bar(page)).toContainText('You can select at most 20 items for one action.')
    const names = await entryNames(page)
    await expect(page.getByRole('checkbox', { name: `Select ${names[19]!}` })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: `Select ${names[20]!}` })).toBeDisabled()
    await expectAccessible()
  })

  test('FR-002 a domain administrator has no selection mode', async ({ page, mockApi }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains')
    await listReady(page)
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0)
  })

  test('SC-008 a bulk action on 50 domains reports 50 outcomes', async ({ page, mockApi }) => {
    await mockApi.use('bulk-fifty')
    await page.goto('domains?size=50')
    await listReady(page)
    await startSelecting(page)
    await page.getByRole('checkbox', { name: 'Select all on this page' }).check()
    await expect(bar(page)).toContainText('50 selected')
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(results(page).locator('li')).toHaveCount(50)
  })
})
