// T025: My account in the shell (FR-001, FR-002, FR-006, research R4; decision D1): reachable from
// the user menu for every role, the Password landing and tabs per role, the capabilities error, and
// Mail setup › Filters availability (US10).
import { expect, test } from '../fixtures/test'
import { isNarrow, openAccountSections, openNavigation } from '../fixtures/flows'

const heading = { level: 1, name: 'Change password' } as const

for (const scenario of ['account-mailbox', 'account-domain-admin', 'account-admin']) {
  test(`FR-001 password settings are reached directly through the user menu (${scenario})`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('')
    const navigation = await openNavigation(page)
    await expect(navigation.getByRole('link', { name: 'User Settings' })).toHaveCount(0)
    if (scenario === 'account-mailbox')
      await expect(navigation.getByRole('link', { name: 'Passkeys', exact: true })).toBeVisible()
    else await expect(navigation.getByRole('link', { name: 'Passkeys' })).toHaveCount(0)
    await expect(
      navigation.locator(
        '[data-nav-item="account-password"], [data-nav-item="account-recoveryEmail"]',
      ),
    ).toHaveCount(0)
    if (isNarrow(page)) await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Account menu of / }).click()
    await expect(page.getByRole('menuitem', { name: 'User Settings' })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Change password', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change password')
    await expect(page).toHaveURL(/\/account\/password$/)
    await page.getByRole('button', { name: /^Account menu of / }).click()
    const recovery = page.getByRole('menuitem', { name: 'Password recovery email', exact: true })
    if (scenario === 'account-mailbox') {
      await recovery.click()
      await expect(page).toHaveURL(/\/account\/recovery-email$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Password recovery email')
    } else await expect(recovery).toHaveCount(0)
  })
}

test('FR-002 administrator account tabs contain password, second factors and passkeys without an overview', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('account')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', heading)).toBeVisible()
  const navigation = await openAccountSections(page)
  const sections = navigation.getByRole('link')
  await expect(sections.first()).toBeVisible()
  const names = (await sections.allInnerTexts()).map((text) => text.trim())
  expect(names).toEqual(['Change password', 'Two-factor authentication', 'Passkeys'])
  await expect(navigation.locator('a[aria-current="page"]')).toHaveText('Change password')
  await navigation.getByRole('link', { name: 'Passkeys', exact: true }).click()
  await expect(page).toHaveURL(/\/ng\/passkeys$/)
  await expect(page.locator('[data-section-nav] a[aria-current="page"]')).toHaveText('Passkeys')
  await expect(page.locator('[data-mailbox-overview]')).toHaveCount(0)
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
