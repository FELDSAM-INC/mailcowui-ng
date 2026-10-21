import { expect, test } from '../fixtures/test'

const mailbox = 'anna@example.org'

test('mailbox filters retain context, preset the owner on creation and do not fetch a personal script', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-many')
  await page.goto(`mailboxes/${mailbox}/filters`)
  await expect(page.locator('[data-filter-id]')).toHaveCount(20)
  await expect(page.getByRole('main')).toContainText(mailbox)
  expect(await mockApi.countRequests('getActiveSieveScript')).toBe(0)
  await expectAccessible()
  await page.getByRole('link', { name: 'Add filter', exact: true }).click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(mailbox)
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('readonly', '')
  await page.getByLabel(/^Short description/).fill('Mailbox rule')
  await page.getByLabel(/^Script/).fill('keep;')
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/mailboxes\/anna(@|%40)example\.org\/filters\/100$/)
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveAttribute(
    'href',
    /targetType=sieveFilter.*targetId=anna/,
  )
  await expectAccessible()
})

test('domain administrator permission is read-only in mailbox context and off-scope mailbox is hidden', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-domain-admin-no-flag')
  await page.goto(`mailboxes/${mailbox}/filters`)
  await expect(page.locator('[data-acl-note]')).toContainText('Prohibited by ACLFilters')
  await expect(page.locator('[data-filter-id]')).toHaveCount(20)
  await expect(page.getByRole('link', { name: 'Add filter', exact: true })).toHaveCount(0)
  await page.locator('[data-filter-id="1"]').getByRole('link').click()
  // The list also contains script previews; wait for the selected detail before reading one.
  await expect(page).toHaveURL(/mailboxes\/anna(@|%40)example\.org\/filters\/1$/)
  await expect(page.locator('[data-filter-list]')).toHaveCount(0)
  await expect(page.locator('[data-filter-form]')).toHaveCount(0)
  await expect(page.locator('pre')).toContainText('fileinto')
  await expectAccessible()
  await page.goto('mailboxes/missing@elsewhere.test/filters')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
})

test('mailbox users cannot open administrative mailbox filters', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-active-script')
  await page.goto(`mailboxes/${mailbox}/filters`)
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('listMailboxSieveFilters')).toBe(0)
  await expectAccessible()
})
