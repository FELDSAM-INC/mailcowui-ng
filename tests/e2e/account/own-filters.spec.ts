import { expect, test } from '../fixtures/test'

test('a mailbox user sees only the active personal script and its copy action', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-active-script')
  await page.goto('account/filters')
  await expect(page.getByRole('heading', { name: 'Active filter', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personal rules', exact: true })).toBeVisible()
  await expect(page.locator('pre')).toContainText('fileinto "News";')
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await expect(page.locator('[data-filter-list]')).toHaveCount(0)
  expect(await mockApi.countRequests('listSieveFilters')).toBe(0)
  expect(await mockApi.countRequests('listMailboxSieveFilters')).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('the empty active-script view has no administrative filters', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-no-active-script')
  await page.goto('account/filters')
  await expect(page.getByRole('main')).toContainText('No active filter available')
  await expect(page.locator('[data-filter-list]')).toHaveCount(0)
  await expectAccessible()
})

test('mail-store failure retries and administrators cannot open an own active-script view', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-active-script-unavailable')
  await page.goto('account/filters')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expectAccessible()
  await mockApi.patch({ selfService: { outages: { mailStore: false } } })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('pre')).toContainText('fileinto')
  await mockApi.use('account-admin')
  await page.goto('account/filters')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('getActiveSieveScript')).toBe(0)
})
