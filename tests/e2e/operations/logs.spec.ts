// UI 011 US3 (T072): reading and searching mailcow's logs as plan "Decisions at implementation"
// settles them: legacy's log choice and names, `debug.log_info`, the search and the time order in
// the address, the newest 50 entries, legacy's "+ 100" and "+ 1000" without duplicates while entries
// arrive, Expand All and Collapse All, cards at 360 px and legacy's columns on desktop, values as
// text, and the loading, empty, no-match, unavailable and not-found states.
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

async function open(page: Page, mockApi: MockApi, scenario: string, path: string) {
  await mockApi.use(scenario)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    page.locator('[data-entry], [data-log-empty], [data-log-error]').first(),
  ).toBeVisible()
}

async function entryIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-entry]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry') ?? ''))
}

async function quickAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

const count = (page: Page) => page.locator('[data-log-count]')

test.describe('logs @operations', () => {
  test('US3-AS1 SC-010 the newest 50 first, then "+ 100" and "+ 1000" without duplicates while entries arrive', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi, 'ops-logs-large', 'operations/logs/postfix')
    await expect(page.getByRole('heading', { level: 1, name: 'Postfix' })).toBeVisible()
    await expect(count(page)).toHaveText('Showing 1 to 50 of 10,003 entries')
    const first = await entryIds(page)
    expect(first[0]).toBe('postfix-10002')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()

    await quickAction(page, '+ 100')
    await expect(page.locator('[data-load-outcome]')).toHaveText('100 additional rows were added')
    await expect(count(page)).toHaveText('Showing 1 to 150 of 10,003 entries')
    await quickAction(page, '+ 1000')
    await expect(count(page)).toHaveText('Showing 1 to 1,150 of 10,003 entries')
    const ids = await entryIds(page)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice(0, 50)).toEqual(first)
    const [, second] = await requestsOf(mockApi, 'listPostfixLog')
    expect(new URL(second!.path, 'http://x').searchParams.get('before')).toBe(first.at(-1))
  })

  test('US3-AS2 FR-037 the search is case-insensitive, announced and kept in the address', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations', 'operations/logs/postfix')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('ALICE@example.org')
    await expect(page).toHaveURL(/q=ALICE(%40|@)example\.org/)
    await expect(count(page)).toHaveText('Showing 1 to 11 of 11 entries')
    for (const text of await page.locator('[data-entry] [data-cell="message"]').allInnerTexts()) {
      expect(text.toLowerCase()).toContain('alice@example.org')
    }
    await expect(page.locator('[data-live="polite"]')).toHaveText('Showing 1 to 11 of 11 entries')
    const request = (await requestsOf(mockApi, 'listPostfixLog')).at(-1)!
    expect(new URL(request.path, 'http://x').searchParams.get('q')).toBe('ALICE@example.org')

    // US3-AS6: a reload and another context show the same log and search.
    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('ALICE@example.org')
    await expect(count(page)).toHaveText('Showing 1 to 11 of 11 entries')
  })

  test('US3-AS4 SC-009 entries are cards at 360 px whose long tokens wrap, with details in place', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    test.skip(!isNarrow(page), 'cards are the phone layout')
    await open(page, mockApi, 'admin-operations', 'operations/logs/postfix')
    const long = page.locator('[data-entry="postfix-100"]')
    await expect(long.locator('[data-cell="time"] time')).toBeVisible()
    await expect(long.locator('[data-cell="priority"]')).toBeVisible()
    await expect(long.locator('[data-cell="message"]')).toContainText('token=A1b2C3d4')
    await expectNoHorizontalScroll()
    const multi = page.locator('[data-entry="postfix-107"] [data-cell="message"]')
    await expect(multi).toHaveText('decoded message 107\nsecond line\nthird line')

    await page.goto('operations/logs/autodiscover')
    const card = page.locator('[data-entry]').first()
    await card.getByRole('button', { name: 'Show details' }).click()
    await expect(card.locator('[data-details]')).toContainText('User-Agent')
    await expectAccessible()
  })

  test('US3-AS5 a legacy API request shows its masked data in the details', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations', 'operations/logs/legacy-api-requests')
    await expect(page.getByRole('heading', { level: 1, name: 'API' })).toBeVisible()
    const entry = page.locator('[data-entry="legacy-api-requests-118"]')
    await entry.getByRole('button', { name: 'Show details' }).click()
    const data = page.locator('[data-details] [data-cell="data"]')
    await expect(data).toContainText('"password": "*"')
    await expect(data).not.toContainText('secret')
  })

  test('US3-AS7 a search without matches offers to clear it', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'admin-operations', 'operations/logs/dovecot?q=nothing-matches-this')
    const empty = page.locator('[data-log-empty]')
    await expect(empty).toContainText('No matching records found')
    await expectAccessible()
    await empty.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(count(page)).toHaveText('Showing 1 to 50 of 120 entries')
  })

  test('US3-AS8 an unavailable log says so and offers a retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-logs-unavailable', 'operations/logs/postfix')
    const error = page.locator('[data-log-error]')
    await expect(error).toContainText('This log is temporarily unavailable.')
    await expectAccessible()
    const before = (await requestsOf(mockApi, 'listPostfixLog')).length
    await error.getByRole('button', { name: 'Try again' }).click()
    await expect
      .poll(async () => (await requestsOf(mockApi, 'listPostfixLog')).length)
      .toBe(before + 1)
    await page.goto('operations/logs/sogo')
    await expect(count(page)).toHaveText('Showing 1 to 50 of 120 entries')
  })

  test("FR-030 legacy's log choice with its groups switches the log, without a row of tabs", async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations', 'operations/logs')
    await expect(page).toHaveURL(/\/operations\/logs\/postfix$/)
    const select = page.getByRole('combobox', { name: 'Logs' })
    await expect(select.locator('optgroup')).toHaveCount(3)
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.locator('[data-log-info]')).toContainText('LOG_LINES (10000)')
    await select.selectOption('cron')
    await expect(page).toHaveURL(/\/operations\/logs\/cron$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Crontasks' })).toBeVisible()
    await select.selectOption('rspamd')
    await expect(page).toHaveURL(/\/operations\/logs\/rspamd$/)
  })

  test("FR-031 FR-032 every log shows legacy's columns", async ({ page, mockApi }) => {
    test.setTimeout(120_000)
    const headers: Record<string, string[]> = {
      postfix: ['Time', 'Priority', 'Message'],
      autodiscover: ['Time', 'User-Agent', 'Username', 'IP', 'Service'],
      watchdog: ['Time', 'Service', 'Trend', 'Message'],
      acme: ['Time', 'Message'],
      'legacy-api-requests': ['Time', 'URI', 'Method', 'IP'],
      'rate-limits': ['Time', 'Rate name', 'Sender', 'Recipients', 'Auth. user', 'Action'],
      cron: ['Time', 'Task', 'Priority', 'Message'],
      'legacy-ui-activity': ['Time', 'Type', 'Task', 'User', 'Role', 'IP', 'Message'],
      logins: ['Username', 'Service', 'IP', 'Login time'],
    }
    await mockApi.use('admin-operations')
    for (const [slug, expected] of Object.entries(headers)) {
      await page.goto(`operations/logs/${slug}`)
      await expect(page.locator('[data-entry]').first()).toBeVisible()
      if (isNarrow(page)) {
        await expect(page.locator('[data-log-cards]')).toBeVisible()
      } else {
        const cells = await page.locator('[data-log-table] thead th').allInnerTexts()
        expect(
          cells.map((cell) => cell.replace(/[▲▼]/g, '').trim()),
          slug,
        ).toEqual(expected)
      }
    }
    await page.goto('operations/logs/autodiscover')
    await expect(page.locator('[data-cell="service"]').first()).toBeVisible()
    await expect(page.getByText('IMAP, SMTP, Cal-/CardDAV').first()).toBeVisible()
    await page.goto('operations/logs/watchdog')
    await expect(page.locator('[data-trend]').first()).toHaveText(/^\s*[+-]?\d+$/)
    await page.goto('operations/logs/logins')
    await expect(page.getByText('WEBUI').first()).toBeVisible()
  })

  test('FR-036 oldest first continues with newer entries and never duplicates', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations', 'operations/logs/postfix')
    if (isNarrow(page)) {
      await page.getByRole('combobox', { name: 'Time' }).selectOption('asc')
    } else {
      await page.getByRole('columnheader', { name: 'Time' }).getByRole('button').click()
      await expect(page.getByRole('columnheader', { name: 'Time' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
    await expect(page).toHaveURL(/order=asc/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', 'postfix-0')
    await quickAction(page, '+ 100')
    await expect(page.locator('[data-load-outcome]')).toHaveText('70 additional rows were added')
    await quickAction(page, '+ 100')
    await expect(page.locator('[data-load-outcome]')).toHaveText('No further rows available')
    const ids = await entryIds(page)
    expect(new Set(ids).size).toBe(120)
  })

  test('FR-038 nothing refreshes on its own; Refresh reloads the newest entries', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await open(page, mockApi, 'admin-operations', 'operations/logs/postfix')
    await quickAction(page, '+ 100')
    await expect(count(page)).toHaveText('Showing 1 to 120 of 120 entries')
    const before = (await requestsOf(mockApi, 'listPostfixLog')).length
    await page.clock.runFor(120_000)
    expect((await requestsOf(mockApi, 'listPostfixLog')).length).toBe(before)
    await mockApi.patch({ operations: { logs: { push: { postfix: 2 } } } })
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(count(page)).toHaveText('Showing 1 to 50 of 122 entries')
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', 'postfix-121')
  })

  test('FR-043 an empty log, and Expand All with Collapse All', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-logs-empty', 'operations/logs/postfix')
    await expect(page.locator('[data-log-empty]')).toHaveText('No data available in table')
    await expect(count(page)).toHaveCount(0)
    await expectAccessible()

    await open(page, mockApi, 'admin-operations', 'operations/logs/rate-limits')
    await quickAction(page, 'Expand All')
    await expect(page.locator('[data-details]')).toHaveCount(50)
    await quickAction(page, 'Collapse All')
    await expect(page.locator('[data-details]')).toHaveCount(0)
  })

  test('Edge: an unknown log type shows "not found" with the way to the logs', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('operations/logs/unknown')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expectAccessible()
    await page.getByRole('link', { name: 'Logs', exact: true }).last().click()
    await expect(page).toHaveURL(/\/operations\/logs\/postfix$/)
    expect(await requestsOf(mockApi, 'listPostfixLog')).not.toEqual([])
  })
})
