// T124: the API key list (US7-AS1, AS6–AS9, FR-063, FR-064, FR-069 and long values).
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation } from '../fixtures/flows'
import { LONG_KEY_NAME } from '../../mocks/scenarios/api-keys'

const heading = { level: 1, name: 'API keys' } as const

/** The listed keys: cards below md, table rows from md up. */
function keys(page: Page) {
  return isNarrow(page) && (page.viewportSize()?.width ?? 0) < 768
    ? page.getByRole('main').getByRole('article')
    : page
        .getByRole('table', { name: 'API keys' })
        .getByRole('row')
        .filter({ has: page.getByRole('cell') })
}

async function openList(page: Page, query = '') {
  await page.goto(`api-keys${query}`)
  await expect(page.getByRole('heading', heading)).toBeVisible()
  await expect(keys(page).first()).toBeVisible()
}

test('US7-AS1 FR-064 each key shows name, prefix, owner, access, status, expiry and last use, as cards on phones and a table on wide screens', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('api-keys-many')
  await openList(page)
  await expect(page).toHaveTitle('API keys – Example Mail')
  await expect(keys(page)).toHaveCount(25)
  const first = keys(page).first()
  await expect(first).toContainText('Billing 60')
  await expect(first).toContainText(/mcv2_\w{7}/)
  await expect(first).toContainText('reseller')
  await expect(first).toContainText('Domain administrator')
  await expect(first).toContainText('Read-Write Access')
  await expect(first).toContainText('Revoked')
  await expect(first).toContainText('198.51.100.7')
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(first).toContainText('Last used')
    await expectTouchTargets()
  } else {
    const table = page.getByRole('table', { name: 'API keys' })
    await expect(table.getByRole('columnheader')).toHaveText([
      'Name',
      'Prefix',
      'Owner',
      'Access',
      'Status',
      'Created',
      'Expires',
      'Last used',
    ])
    await expect(table.getByRole('columnheader', { name: 'Created' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  }
  await expect(page.getByRole('main')).toContainText('Showing 1 to 25 of 60 entries')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US7-AS6 FR-064 filters, sort and page are kept in the address and survive a reload', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-many')
  await openList(page)
  await page.getByLabel('Status').selectOption('revoked')
  await expect(page).toHaveURL(/status=revoked/)
  await expect(page.getByRole('main')).toContainText('Showing 1 to 12 of 12 entries')
  await page.getByRole('combobox', { name: 'Access', exact: true }).selectOption('readWrite')
  await expect(page).toHaveURL(/access=readWrite/)
  await expect(page.getByRole('main')).toContainText('of 4')
  await page.reload()
  await expect(page.getByLabel('Status')).toHaveValue('revoked')
  await expect(page.getByRole('combobox', { name: 'Access', exact: true })).toHaveValue('readWrite')
  await expect(page.getByRole('main')).toContainText('of 4')
  await expectAccessible()

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('main')).toContainText('Showing 1 to 25 of 60 entries')

  // The owner picker, and a typed username for an owner that is no longer a candidate.
  const owner = page.getByRole('combobox', { name: 'Owner' })
  await owner.fill('res')
  await page.getByRole('option', { name: /^reseller\b/ }).click()
  await expect(page).toHaveURL(/owner=reseller/)
  await expect(page.getByRole('main')).toContainText('of 9')
  await owner.fill('former')
  await owner.press('Enter')
  await expect(page).toHaveURL(/owner=former/)
  await expect(keys(page)).toHaveCount(1)
  await page.reload()
  await expect(owner).toHaveValue('former')
  await expect(keys(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).click()

  // Sort and page.
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByLabel('Sort by').selectOption('name:asc')
  } else {
    await page.getByRole('columnheader', { name: 'Name' }).getByRole('button').click()
  }
  await expect(page).toHaveURL(/sort=name/)
  await expect(keys(page).first()).toContainText('Billing 01')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(keys(page).first()).toContainText('Billing 27')
  await page.reload()
  await expect(keys(page).first()).toContainText('Billing 27')
  await expect(page.getByRole('main')).toContainText('Showing 26 to 50 of 60 entries')
})

test('US7-AS7 a key whose owner is deactivated or deleted is flagged as unusable', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-key-owner-deactivated')
  await openList(page)
  const warning = 'The owner is deactivated or deleted, so this key cannot be used.'
  await expect(keys(page).filter({ hasText: 'former' })).toContainText(warning)
  await expect(keys(page).filter({ hasText: 'olduser' })).toContainText(warning)
  await expect(keys(page).filter({ hasText: 'olduser' })).toContainText('Deleted account')
  await expect(keys(page).filter({ hasText: 'Billing 03' })).not.toContainText(warning)
  await expectAccessible()
})

test('US7-AS8 without keys an empty state explains them and offers to create one', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('api-keys-empty')
  await page.goto('api-keys')
  const empty = page.locator('[data-empty]')
  await expect(empty).toContainText('No API keys yet')
  await expect(empty).toContainText('API keys let other programs')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await empty.getByRole('link', { name: 'Create API key' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Create API key' })).toBeVisible()
})

test('US7-AS9 FR-063 domain administrators and mailbox users get no entry and "no access"', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  for (const account of ['reseller', 'alice@example.org']) {
    await mockApi.use('mailbox-password', { signedInAs: account })
    await page.goto('api-keys')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    const navigation = await openNavigation(page)
    await expect(navigation.getByRole('link', { name: 'API keys' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    const ops = (await mockApi.requests()).map((r) => r.operationId)
    expect(ops).not.toContain('listApiKeys')
  }
  await expectAccessible()
})

test('FR-069 the section links to the API documentation', async ({ page, mockApi }) => {
  await mockApi.use('api-keys-many')
  await openList(page)
  await expect(page.getByRole('link', { name: /API documentation/ })).toHaveAttribute(
    'href',
    '/api/v2/docs',
  )
})

test('Edge: a 255-character name and a long network list wrap without horizontal scrolling', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('api-keys-many')
  await openList(page, '?page=2')
  await expect(page.getByRole('main').getByText(LONG_KEY_NAME)).toBeVisible()
  await expectNoHorizontalScroll()
  await page.getByRole('link', { name: LONG_KEY_NAME }).click()
  await expect(page.getByRole('heading', { level: 1, name: LONG_KEY_NAME })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('2001:db8:c::/48')
  await expectNoHorizontalScroll()
})
