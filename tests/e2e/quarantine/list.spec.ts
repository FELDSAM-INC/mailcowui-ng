import { expect, test } from '../fixtures/test'

test('US1 list: newest first, paging, page sizes and inert message text', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  guardRequests,
}) => {
  void guardRequests
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  const items = page.locator('[data-quarantine-item]')
  await expect(items).toHaveCount(25)
  await expect(items.first()).toHaveAttribute('data-quarantine-item', '30')
  await expect(items.last()).toHaveAttribute('data-quarantine-item', '6')
  await expect(page.locator('[data-quarantine-active]')).toContainText('20')
  await expect(page.locator('[data-quarantine-active]')).toContainText('15')
  await expect(page.locator('[data-quarantine-item="11"] script')).toHaveCount(0)
  await expect(page.locator('[data-quarantine-item="13"] [data-marker]').first()).toContainText(
    'U+202E',
  )
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(items).toHaveCount(5)
  await expect(page).toHaveURL(/page=2/)
  await page.locator('[data-page-size] select').selectOption('50')
  await expect(items).toHaveCount(30)
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.locator('[data-page-size] option')).toHaveText(['25', '50', '100'])
})

test('US1 filters: apply once, restore the view on reload, and clear with a chip', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await page.locator('[data-filter-toggle]').click()
  await page.locator('#quarantine-virus').selectOption('true')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await expect(page.locator('#quarantine-recipient')).toHaveCount(0)
  await expectAccessible()
  await page.locator('[data-filter-panel] button[type="submit"]').click()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(1)
  await expect(page).toHaveURL(/virus=true/)
  await page.reload()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(1)
  await page.getByRole('button', { name: /Remove filter.*Danger/ }).click()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await page.locator('#quarantine-search').fill('no-message-matches-this')
  await expect(page.locator('[data-no-matches]')).toBeVisible()
  await page.locator('[data-no-matches] button').click()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
})

test('mobile card details open by keyboard after scrolling and reset when paging', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, 'Cards are the mobile layout')
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  const item = page.locator('[data-quarantine-item="6"]')
  const details = item.locator('details')
  const summary = details.locator('summary')
  await expect(item).toBeAttached()
  await expect(details.locator('dd')).toHaveCount(0)
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details.locator('[data-virus]')).toBeVisible()
  await expect(details.locator('[data-notified]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await summary.press('Space')
  await expect(details.locator('dd')).toHaveCount(0)
  await summary.press('Enter')
  await expect(details.locator('[data-virus]')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(5)
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(item).toBeAttached()
  await expect(details.locator('dd')).toHaveCount(0)
})

test('US1 list: empty, inactive and read-only quarantine remain usable', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-empty')
  await page.goto('quarantine')
  await expect(page.locator('[data-empty]')).toHaveText('No data available in table')
  await mockApi.use('quarantine-inactive')
  await page.reload()
  await expect(page.locator('[data-quarantine-inactive]')).toBeVisible()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await mockApi.use('quarantine-user-no-actions')
  await page.reload()
  await expect(page.locator('#quarantine-actions-acl')).toBeVisible()
  await expect(page.locator('[data-select-mode]')).toHaveCount(0)
  await expect(page.locator('[data-quarantine-item] button')).toHaveCount(0)
  await expect(
    page.locator('[data-quarantine-item]').first().getByRole('link').first(),
  ).toHaveAttribute('href', '/ng/quarantine/30')
})

test('US1 list: a failed load offers a manual retry', async ({ page, mockApi }) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.route('**/api/v2/quarantine?*', (route) => route.abort())
  await page.goto('quarantine')
  await expect(page.getByText('The list could not be loaded.', { exact: true })).toBeVisible()
  await page.unroute('**/api/v2/quarantine?*')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
})

test('US1 list: removing an item asks first and sends its version once', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine')
  const item = page.locator('[data-quarantine-item="30"]')
  await clickRowAction(page, item, /^Remove(?:\: 30)?$/)
  await expect(page.getByRole('alertdialog')).toBeVisible()
  expect(
    (await mockApi.requests()).filter((request) => request.operationId === 'deleteQuarantineItem'),
  ).toHaveLength(0)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(item).toBeVisible()
  await clickRowAction(page, item, /^Remove(?:\: 30)?$/)
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete now', exact: true })
    .click()
  await expect(item).toHaveCount(0)
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'deleteQuarantineItem',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.headers['if-match']).toMatch(/^"q/)
  await expect(page.locator('[data-alert="success"]')).toBeVisible()
})

test('US2 list: administrators filter by recipient and sort the results in either layout', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('quarantine-admin')
  await page.goto('quarantine')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await page.locator('[data-filter-toggle]').click()
  await page.locator('#quarantine-recipient').fill('bob@example.org')
  await page.locator('[data-filter-panel] button[type="submit"]').click()
  const items = page.locator('[data-quarantine-item]')
  await expect(items).toHaveCount(5)
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const id = page.getByRole('columnheader', { name: 'ID', exact: true })
    await id.getByRole('button').click()
    await expect(id).toHaveAttribute('aria-sort', 'descending')
    await id.getByRole('button').click()
    await expect(id).toHaveAttribute('aria-sort', 'ascending')
  } else {
    await page.locator('#quarantine-sort').selectOption('id')
    await page.locator('#quarantine-order').selectOption('asc')
  }
  await expect(items.first()).toHaveAttribute('data-quarantine-item', '31')
  await expect(items.last()).toHaveAttribute('data-quarantine-item', '35')
  await page.reload()
  await expect(items.first()).toHaveAttribute('data-quarantine-item', '31')
  await expectAccessible()
  await expectNoHorizontalScroll()
})
import { clickRowAction } from '../fixtures/row-actions'
