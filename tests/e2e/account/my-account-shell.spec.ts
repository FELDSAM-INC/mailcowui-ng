// T025: My account in the shell (FR-001, FR-002, FR-006, research R4; decision D1): reachable from
// the navigation and the user menu for every role, the hub per role, the capabilities error, and
// Mail setup › Filters availability (US10).
import { expect, test } from '../fixtures/test'
import { openNavigation } from '../fixtures/flows'

const heading = { level: 1, name: 'User Settings' } as const

for (const scenario of ['account-mailbox', 'account-domain-admin', 'account-admin']) {
  test(`FR-001 My account is one interaction away in the navigation and the user menu (${scenario})`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('')
    const navigation = await openNavigation(page)
    await navigation.getByRole('link', { name: 'User Settings' }).click()
    await expect(page.getByRole('heading', heading)).toBeVisible()
    await expect(page).toHaveURL(/\/ng\/account$/)
    await page.goto('')
    await page.getByRole('button', { name: /^Account menu of / }).click()
    await page.getByRole('menuitem', { name: 'User Settings' }).click()
    await expect(page.getByRole('heading', heading)).toBeVisible()
  })
}

test('FR-002 the hub of an administrator lists the password, second factors and passkeys only', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('account')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', heading)).toBeVisible()
  const sections = main.locator('[data-sections] a')
  await expect(sections.first()).toBeVisible()
  const names = (await sections.allInnerTexts()).map((text) => text.trim())
  expect(names).toContain('Passkeys')
  expect(names).not.toContain('Overview')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('Edge: a section that needs the unreadable capabilities shows its error state with "Try again"', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-capabilities-unavailable')
  await page.goto('account/password')
  const main = page.getByRole('main')
  await expect(main.getByText('This item could not be loaded.')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expectAccessible()
})

test('FR-044 Mail setup › Filters opens its native list', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-admin')
  await page.goto('filters')
  const main = page.getByRole('main')
  await expect(page.getByRole('heading', { level: 1, name: 'Filters' })).toBeVisible()
  await expect(main.getByRole('link', { name: 'Add filter', exact: true })).toHaveAttribute(
    'href',
    '/ng/filters/new',
  )
  await expect(main).not.toContainText('This section comes in a later version of the app.')
  await expectAccessible()
})
