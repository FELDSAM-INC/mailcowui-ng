import { expect, test } from '../fixtures/test'

test('US8 statistics show counts, percentages and the collection period without polling', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('spam-statistics')
  await page.goto('quarantine/statistics')
  await expect(page.locator('[data-action="rejected"] [data-count]')).toHaveText('120')
  await expect(page.locator('[data-action="rejected"] [data-share]')).toHaveText('12.0%')
  await expect(page.locator('[data-total]')).toContainText('1,000')
  await expect(page.locator('[data-period]')).not.toBeEmpty()
  await expectAccessible()
  await expectNoHorizontalScroll()
  const reads = () =>
    mockApi
      .requests()
      .then((rs) => rs.filter((r) => r.operationId === 'getSpamFilterActionStatistics'))
  expect(await reads()).toHaveLength(1)
  await page.locator('[data-refresh]').click()
  await expect.poll(async () => (await reads()).length).toBe(2)
})

test('US8 empty and unavailable statistics remain readable and retryable', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('spam-statistics-zero')
  await page.goto('quarantine/statistics')
  await expect(page.locator('[data-share]')).toHaveText(Array(5).fill('0.0%'))
  await expectAccessible()
  await mockApi.use('spam-statistics-unavailable')
  await page.reload()
  await expect(page.locator('[data-unavailable]')).toBeVisible()
  await expect(
    page.locator('[data-unavailable]').getByRole('button', { name: 'Try again', exact: true }),
  ).toBeVisible()
  await expectAccessible()
})
