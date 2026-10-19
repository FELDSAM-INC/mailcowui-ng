// UI 011 US6 (T118; plan decisions 11, 12, 18 and 19): Rspamd's statistics as labelled bars with a
// summary and a table, and the scan history with search, sort, paging and details, each failing
// and retrying on its own.
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

async function open(
  page: Page,
  mockApi: MockApi,
  scenario: string,
  path = 'operations/logs/rspamd',
) {
  await mockApi.use(scenario)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: 'Rspamd history' })).toBeVisible()
}

test.describe('Rspamd @operations', () => {
  test('US6-AS1 the search finds the rejected message with its score and symbols', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi, 'ops-rspamd')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('spammer@example.net')
    await expect(page).toHaveURL(/q=spammer(%40|@)example\.net/)
    await expect(page.locator('[data-entry]')).toHaveCount(1)
    const entry = page.locator('[data-entry]')
    await expect(entry.locator('[data-cell="action"]')).toHaveText('reject')
    await expect(entry.locator('[data-cell="score"]')).toHaveText(
      '18.37 / 15 above the required score',
    )
    await entry.getByRole('button', { name: 'Show details' }).click()
    await expect(page.locator('[data-symbol]')).toHaveText([
      'BAYES_SPAM (5.1) [99.99%]',
      'RBL_SPAMHAUS (4) [66.113.0.203.zen.spamhaus.org]',
      'DMARC_POLICY_ALLOW (-0.5) [example.net, none]',
      'ARC_NA (0)',
    ])
    await expect(page.locator('[data-details] [data-cell="user"]')).toHaveText('none')
    await expect(page.getByText('You won <b>1,000,000</b>').first()).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('US6-AS2 US6-AS3 the actions as labelled bars with a summary and a table', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'admin-operations')
    const statistics = page.locator('[data-rspamd-statistics]')
    await expect(statistics.getByRole('heading', { name: 'Chart (this server)' })).toBeVisible()
    await expect(statistics.locator('[data-summary]')).toHaveText(
      'Most messages (82%) got the action no action.',
    )
    await expect(statistics.locator('[data-action]')).toHaveCount(6)
    await expect(statistics.locator('[data-action="reject"]')).toContainText('25 messages')
    await statistics.getByRole('button', { name: 'Show the values as a table' }).click()
    const table = statistics.getByRole('table', { name: 'Chart (this server)' })
    await expect(table.getByRole('row')).toHaveCount(7)
    await expect(table.getByRole('row', { name: /greylist/ })).toContainText('4%')
    await expectAccessible()
  })

  test('US6-AS4 an unreachable controller fails the statistics and the history separately', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-rspamd-unavailable')
    await expect(page.getByText('Rspamd cannot be reached right now.')).toHaveCount(2)
    await expectAccessible()
    await mockApi.patch({ operations: { inject: { getRspamdStatistics: null } } })
    await page
      .locator('[data-rspamd-statistics]')
      .getByRole('button', { name: 'Try again' })
      .click()
    await expect(page.locator('[data-rspamd-statistics] [data-action]')).toHaveCount(6)
    await expect(page.locator('[data-history-error]')).toContainText(
      'Rspamd cannot be reached right now.',
    )
  })

  test('FR-046 FR-049 nothing scanned yet and an empty history', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-rspamd-zero')
    await expect(page.locator('[data-none-scanned]')).toHaveText('No messages were scanned yet.')
    await expect(page.locator('[data-history-empty]')).toHaveText('No data available in table')
    await expectAccessible()
  })

  test('FR-047 the history is paged and sorted by the API, kept in the address', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations')
    await expect(page.locator('[data-entry]')).toHaveCount(25)
    await expect(page.getByText('Showing 1 to 25 of 60 entries')).toBeVisible()
    if (isNarrow(page)) {
      await page.getByRole('combobox', { name: 'Sort by' }).selectOption('score')
    } else {
      await page.getByRole('button', { name: 'Score' }).click()
      await expect(page.getByRole('columnheader', { name: 'Score' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
    await expect(page).toHaveURL(/sort=score/)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/page=2/)
    const request = (await mockApi.requests())
      .filter((item) => item.operationId === 'listRspamdHistory')
      .at(-1)!
    const query = new URL(request.path, 'http://x').searchParams
    expect([query.get('sort'), query.get('offset'), query.get('limit')]).toEqual([
      'score',
      '25',
      '25',
    ])
    await page.reload()
    await expect(page.locator('[data-entry]')).toHaveCount(25)
    await expect(page.getByText('Showing 26 to 50 of 60 entries')).toBeVisible()
  })

  test('FR-030 Rspamd is chosen in the log choice, with debug.log_info', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'admin-operations')
    await expect(page.getByRole('combobox', { name: 'Logs' })).toHaveValue('rspamd')
    await expect(page.locator('[data-log-info]')).toContainText('External logs')
  })
})
