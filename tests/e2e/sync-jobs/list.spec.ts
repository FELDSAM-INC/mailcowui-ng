// UI 008 US1, the sync job list (T023): cards and table, the classic columns and values, results
// in English and Czech, the list states, search, filters, sort, paging, the address and refresh.
import { expect, test } from '../fixtures/test'
import { rowAction } from '../fixtures/row-actions'
import { entries, entry, entryIds, isNarrow, listReady, openFilters, requestsOf } from './helpers'

test.describe('sync job list', () => {
  test('US1-AS1 FR-005 cards at 360 px show the classic values without horizontal scroll', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    test.skip(!isNarrow(page), 'cards are the small-screen layout')
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    const card = entry(page, 2)
    await expect(
      card.getByRole('heading', { name: 'alice@mail.previous.example:993' }),
    ).toBeVisible()
    await expect(card).toContainText('alice@example.org')
    await expect(card).toContainText('Wrong username or password')
    await expect(card).toContainText('Waiting')
    await expect(await rowAction(page, card, 'Open logs')).toBeVisible()
    await page.keyboard.press('Escape')
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll(page, { widths: [360, 320] })
  })

  test('US1-AS2 FR-011 the table has the classic columns, sortable headers and newest first', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    await listReady(page)
    expect((await entryIds(page)).slice(0, 3)).toEqual([60, 59, 58])
    if (isNarrow(page)) {
      await page.getByLabel('Sort by').selectOption('remoteHost')
      await expect(page).toHaveURL(/sort=remoteHost/)
      return
    }
    const table = page.getByRole('table')
    for (const header of [
      'ID',
      'Owner',
      'Server',
      'Last run',
      'Last run result',
      'Active',
      'Status',
      'Action',
    ]) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
    }
    const id = table.getByRole('columnheader', { name: 'ID', exact: true })
    await expect(id).toHaveAttribute('aria-sort', 'descending')
    await table.getByRole('button', { name: 'Server' }).click()
    await expect(page).toHaveURL(/sort=remoteHost/)
    await expect(table.getByRole('columnheader', { name: 'Server' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    await page
      .getByRole('button', { name: /^Details of / })
      .first()
      .click()
    await expect(page.locator('[data-entry-details]').first()).toContainText('Excludes')
    await expect(page.locator('[data-entry-details]').first()).toContainText('Interval (min)')
    await expectAccessible()
  })

  test('US1-AS5 FR-006 FR-007 results read the classic texts with a glyph, in English and Czech', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?size=100&sort=id&order=asc')
    await listReady(page)
    const texts: [number, string][] = [
      [3, 'Success'],
      [6, 'Connection problem'],
      [7, "Can't connect to remote server"],
      [8, 'Problem with encrypted connection'],
      [9, 'Authentication problem'],
      [10, 'Wrong username or password'],
      [11, 'Target mailbox is over quota'],
      [12, 'Check log'],
      [13, 'Check log'],
      [16, 'Check log'],
    ]
    for (const [id, text] of texts) {
      await expect(entry(page, id).locator('[data-result]')).toContainText(text)
    }
    await expect(entry(page, 6).locator('[data-result]')).toContainText('Failed:')
    await expect(entry(page, 3).locator('[data-result]')).toContainText('Succeeded:')
    await expect(entry(page, 3).locator('[data-result] svg')).toBeVisible()
    // An inactive job that is running shows both facts.
    await expect(entry(page, 5)).toContainText('Running')
    await expect(entry(page, 5).locator('[data-active]')).toContainText('✕')
    await expect(entry(page, 4).locator('[data-active]')).toContainText('✓')

    await mockApi.use('sync-jobs-admin', {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'system', etag: '"p"' } } },
    })
    await page.goto('sync-jobs?q=previous')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Synchronizační úlohy' }),
    ).toBeVisible()
    await expect(entry(page, 2)).toContainText('Chybné uživatelské jméno nebo heslo')
  })

  test('US1-AS6 a never-run and a rescheduled job read "Waiting" without a result', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?size=100&sort=id&order=asc')
    await listReady(page)
    for (const id of [1, 15]) {
      await expect(entry(page, id).locator('[data-last-run]')).toHaveText('Waiting')
      await expect(entry(page, id).locator('[data-result]')).toHaveText('-')
    }
  })

  test('US1-AS7 FR-013 the empty state offers creation, no match offers clearing', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-empty')
    await page.goto('sync-jobs')
    await expect(page.getByText('No data available in table')).toBeVisible()
    await expect(
      page.locator('[data-empty]').getByRole('link', { name: 'Create new sync job' }),
    ).toBeVisible()
    await expectAccessible()
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=nothing-matches-this')
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search and filters' }).click()
    await expect(page).toHaveURL(/\/sync-jobs$/)
    await listReady(page)
    expect(await entries(page).count()).toBe(25)
  })

  test('US1-AS7 FR-047 a failed load offers a retry with the request ID', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin', { failures: { listSyncJobs: { status: 500, times: 1 } } })
    await page.goto('sync-jobs')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await expect(page.getByText(/Request ID:/)).toBeVisible()
    await expectAccessible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await listReady(page)
    await expect(entries(page).first()).toBeVisible()

    await page.route('**/api/v2/sync-jobs?*', (route) => route.abort())
    await page.reload()
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await page.unroute('**/api/v2/sync-jobs?*')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(entries(page).first()).toBeVisible()
  })

  test('US1-AS8 FR-009 search, filters and the announced match count', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('previous')
    await expect.poll(() => entryIds(page)).toEqual([2])
    await expect(page.locator('[data-result-count]')).toHaveText('Sync jobs found: 1')
    await expect(page.locator('[data-live="polite"]')).toContainText('Sync jobs found: 1')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('')
    await openFilters(page)
    await page.getByLabel('Status', { exact: true }).selectOption('yes')
    await expect(page).toHaveURL(/running=yes/)
    await expect.poll(() => entryIds(page)).toEqual([5, 4])
    await page.getByLabel('Last run result', { exact: true }).selectOption('none')
    await expect(page).toHaveURL(/result=none/)
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByLabel('Last run result', { exact: true }).selectOption('')
    await page.getByLabel('Status', { exact: true }).selectOption('')
    await page.getByLabel('Active', { exact: true }).selectOption('no')
    await expect(page).toHaveURL(/active=no/)
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
    await expectAccessible()
    await page.goto('sync-jobs?mailbox=carol%40example.net&domain=example.net')
    await listReady(page)
    for (const id of await entryIds(page)) await expect(entry(page, id)).toContainText('carol@')
  })

  test('FR-010 FR-012 the address keeps the view, nothing is stored, and pages work by touch', async ({
    page,
    mockApi,
    expectTouchTargets,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?sort=lastRunAt&order=desc&size=50')
    await listReady(page)
    await expect(page.getByText(/Showing 1 to 50 of/)).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await page.reload()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText(/Showing 51 to/)).toBeVisible()
    await page.goBack()
    await expect(page).not.toHaveURL(/page=2/)
    const [local, session] = await page.evaluate(
      () => [Object.keys(localStorage), Object.keys(sessionStorage)] as const,
    )
    expect(session).toEqual([])
    expect(local.filter((key) => /sync|job/i.test(key))).toEqual([])
    if (isNarrow(page)) await expectTouchTargets()
  })

  test('FR-051 FR-008 Edge: relative times with the absolute one, and long values wrap', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=long.example')
    const item = entry(page, 17)
    await expect(item.locator('[data-last-run] time')).toHaveAttribute('title', /2026/)
    await expect(item).toContainText('long.example')
    await expectNoHorizontalScroll(page, isNarrow(page) ? { widths: [360, 320] } : undefined)
  })

  test('FR-014 the manual refresh refetches the list', async ({ page, mockApi }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs')
    await listReady(page)
    const before = (await requestsOf(mockApi, 'listSyncJobs')).length
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect
      .poll(async () => (await requestsOf(mockApi, 'listSyncJobs')).length)
      .toBe(before + 1)
  })
})
