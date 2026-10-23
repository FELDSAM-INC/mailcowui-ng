import { expect, test } from '../fixtures/test'

test.describe('shared list feedback @list-feedback', () => {
  test('policy search announces no matches and clearing restores the combined list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('policy-user')
    await page.goto('spam-filter')
    const allow = page.locator('[data-policy-list="allow"]')
    const entries = allow.locator('[data-entry]')
    await expect(entries.first()).toBeVisible()
    const count = await entries.count()

    await allow.getByRole('searchbox', { name: 'Search:' }).fill('no-such-policy-pattern')
    await expect(allow.locator('[data-empty="noMatch"]')).toBeVisible()
    await expect(entries).toHaveCount(0)
    await expect(page.locator('[data-live="polite"]')).toHaveText('Showing 0 to 0 of 0 entries')
    await allow.locator('[data-empty="noMatch"]').getByRole('button').click()

    await expect(entries).toHaveCount(count)
    await expect(allow.getByRole('searchbox', { name: 'Search:' })).toHaveValue('')
    await expect(allow.locator('[data-empty="noMatch"]')).toHaveCount(0)
  })

  test('rate-limit search distinguishes no matches and clearing restores the entries', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('rate-limits-admin')
    await page.goto('quarantine/rate-limits')
    await expect(page.locator('[data-list-state="ready"]')).toBeVisible()
    await expect(page.locator('[data-entry]')).toHaveCount(8)

    await page.getByRole('searchbox', { name: 'Search:' }).fill('no-such-rate-limit')
    await expect(page.locator('[data-no-matches]')).toBeVisible()
    await expect(page.locator('[data-entry]')).toHaveCount(0)
    await expect(page.locator('[data-no-matches]')).toContainText('No matching records found')
    await page.locator('[data-no-matches]').getByRole('button').click()

    await expect(page.locator('[data-list-state="ready"]')).toBeVisible()
    await expect(page.locator('[data-entry]')).toHaveCount(8)
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('')
    expect(new URL(page.url()).searchParams.has('q')).toBe(false)
  })

  test('Rspamd history and statistics recover independently through their retry controls', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-rspamd-unavailable')
    await page.goto('operations/logs/rspamd')
    const historyError = page.locator('[data-history-error]')
    const statistics = page.locator('[data-rspamd-statistics]')
    await expect(historyError).toContainText('Rspamd cannot be reached right now.')
    await expect(statistics).toContainText('Rspamd cannot be reached right now.')

    await mockApi.patch({ operations: { inject: { listRspamdHistory: null } } })
    await historyError.getByRole('button', { name: 'Try again' }).click()
    await expect(historyError).toHaveCount(0)
    await expect(page.locator('[data-entry]')).toHaveCount(25)
    await expect(statistics).toContainText('Rspamd cannot be reached right now.')

    await mockApi.patch({ operations: { inject: { getRspamdStatistics: null } } })
    await statistics.getByRole('button', { name: 'Try again' }).click()
    await expect(statistics.locator('[data-action]')).toHaveCount(6)
    await expect(page.locator('[data-entry]')).toHaveCount(25)
  })

  test('empty Rspamd history keeps its own message alongside the statistics empty state', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-rspamd-zero')
    await page.goto('operations/logs/rspamd')
    await expect(page.locator('[data-none-scanned]')).toHaveText('No messages were scanned yet.')
    await expect(page.locator('[data-history-empty]')).toHaveText('No data available in table')
    await expect(page.locator('[data-history-error]')).toHaveCount(0)
    await expect(page.locator('[data-entry]')).toHaveCount(0)
  })
})
