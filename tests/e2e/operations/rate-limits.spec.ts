// UI 011 US3-AS9 (T073; plan decisions 2, 16 and 26): legacy's "Remove hash" in the rate-limited
// log, confirmed with legacy's #ConfirmDeleteModal texts, reset through API 006, with legacy's
// outcomes, and offered only for an entry whose hash names a bucket.
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

async function open(page: Page, mockApi: MockApi) {
  await mockApi.use('ops-rate-limits')
  await page.goto('operations/logs/rate-limits')
  await expect(page.locator('[data-entry]').first()).toBeVisible()
}

async function resets(mockApi: MockApi) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'resetRateLimitBucket',
  )
}

test.describe('rate limit reset @operations', () => {
  test('US3-AS9 SC-007 "Remove hash" asks first, resets the bucket and refreshes the log', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi)
    await expect(
      page.getByText(
        'Removing a ratelimit hash (if still existing) will reset its counter completely.',
      ),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()

    const entry = page.locator('[data-entry="rate-limits-39"]')
    const remove = entry.getByRole('button', { name: 'Remove hash' })
    await remove.click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText('Please confirm your changes to the following object id')
    await expect(dialog).toContainText('RLbucket0hash')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(remove).toBeFocused()
    expect(await resets(mockApi)).toEqual([])

    await remove.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-status-message]')).toHaveText('Hash deleted')
    const [request] = await resets(mockApi)
    expect(request!.path).toBe('/api/v2/rate-limit-buckets/RLbucket0hash')
    await expect(page.locator('[data-entry="rate-limits-39"]')).toHaveCount(0)
    await expect(page.locator('[data-entry]').first()).toBeVisible()
  })

  test('US3-AS9 a bucket reset meanwhile says that the hash was not found', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await mockApi.patch({
      operations: { inject: { resetRateLimitBucket: { status: 404, times: 1 } } },
    })
    await page
      .locator('[data-entry="rate-limits-37"]')
      .getByRole('button', { name: 'Remove hash' })
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-status-message]')).toHaveText(
      'Hash not found or already deleted',
    )
  })

  test('FR-039 an entry without a bucket hash shows "err" and offers no reset', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    // Sequence 27 has no hash (27 % 11 = 5).
    const entry = page.locator('[data-entry="rate-limits-27"]')
    await expect(entry.getByRole('button', { name: 'Remove hash' })).toHaveCount(0)
    await entry.getByRole('button', { name: 'Show details' }).click()
    await expect(page.locator('[data-details] [data-cell="hash"]')).toHaveText('err')
  })
})
