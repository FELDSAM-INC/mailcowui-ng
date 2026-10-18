// T093: the home screen and the shell (US3-AS6, AS8, AS9, FR-001a, FR-002, FR-042, FR-047, FR-048,
// FR-084 and the long-username edge case).
import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation } from '../fixtures/flows'

test('US3-AS6 FR-047 home lists the two domains of a domain administrator, with shortcuts to the visible sections', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('domain-admin-two-domains')
  await page.goto('')
  const main = page.getByRole('main')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, reseller' })).toBeVisible()
  const scope = main.getByRole('region', { name: 'Your scope' })
  await expect(scope.getByRole('listitem')).toHaveText(['example.org', 'example.net'])
  const shortcuts = main.getByRole('region', { name: 'Sections' })
  const navigation = await openNavigation(page)
  const visible = (await navigation.getByRole('link').allInnerTexts()).map((t) => t.trim())
  if (isNarrow(page)) await page.keyboard.press('Escape')
  await expect(shortcuts.getByRole('link')).toHaveText(visible.filter((label) => label !== 'Home'))
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US3-AS6 home says that no domains are assigned', async ({ page, mockApi }) => {
  await mockApi.use('domain-admin-no-domains')
  await page.goto('')
  await expect(
    page.getByRole('region', { name: 'Your scope' }).getByText('No domains are assigned to you.'),
  ).toBeVisible()
})

test('FR-047 home shows all domains for an administrator and the mailbox for a mailbox user', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.getByRole('region', { name: 'Your scope' })).toContainText(
    'You manage all domains.',
  )
  await expect(
    page.getByRole('region', { name: 'Sections' }).getByRole('link', { name: 'Audit log' }),
  ).toBeVisible()

  await mockApi.use('mailbox-no-spam-flags')
  await page.goto('')
  await expect(page.getByRole('region', { name: 'Your scope' })).toContainText(
    'Your mailbox: alice@example.org',
  )
  await expect(page.getByRole('region', { name: 'Sections' }).getByRole('link')).toHaveText([
    'User Settings',
    'Passkeys',
    'Quarantine',
  ])
})

for (const [scenario, type] of [
  // The classic announcement type names (`admin.ui_header_announcement_type_*`).
  ['announcement-info', 'Info'],
  ['announcement-warning', 'Important'],
  ['announcement-danger', 'Very important'],
] as const) {
  test(`US3-AS8 FR-048 FR-084 the ${scenario} is on every page with its type in text, and collapses for the visit`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use(scenario)
    await page.goto('')
    const banner = page.locator('[data-announcement]')
    await expect(banner).toContainText(`${type}:`)
    await expect(banner).toContainText('announcement for everybody.')
    await expectAccessible()
    await page.goto('domains')
    await expect(banner).toContainText('announcement for everybody.')
    await banner.getByRole('button', { name: 'Hide announcement' }).click()
    const show = banner.getByRole('button', { name: 'Show announcement' })
    await expect(show).toBeVisible()
    await expect(show).toContainText(type)
    await expectAccessible()
    await page.goto('quarantine')
    await expect(show).toBeVisible()
    await page.reload()
    await expect(
      page.locator('[data-announcement]').getByRole('button', { name: 'Show announcement' }),
    ).toBeVisible()
  })
}

test('US3-AS8 FR-002 the footer is sanitised on signed-in pages', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('footer-malicious')
  await page.goto('')
  const footer = page.getByRole('contentinfo')
  await expect(footer.locator('b')).toHaveText('Footer')
  await expect(footer.locator('form, input, style, script')).toHaveCount(0)
  await expectAccessible()
})

test('US3-AS9 FR-001a the apps menu lists the links in order under the operator label, with %u encoded', async ({
  page,
  mockApi,
  expectAccessible,
  expectTouchTargets,
}) => {
  await mockApi.use('app-links-webmail-and-two')
  await page.goto('')
  await page.getByRole('button', { name: 'Our services menu' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveText(['Webmail', 'Helpdesk', 'Billing'])
  await expect(menu.getByRole('menuitem', { name: 'Helpdesk' })).toHaveAttribute(
    'href',
    'https://helpdesk.example.org/?user=alice%40example.org',
  )
  await expect(menu.getByRole('menuitem', { name: 'Billing' })).toHaveAttribute(
    'href',
    'https://billing.example.org/login?u=alice%40example.org',
  )
  await expectAccessible()
  await expectTouchTargets()
  await page.keyboard.press('Escape')
})

test('US3-AS9 webmail is missing when the groupware is disabled, and a javascript: link is not rendered', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('app-links-groupware-disabled')
  await page.goto('')
  await page.getByRole('button', { name: 'Apps menu' }).click()
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Helpdesk', 'Billing'])
  await page.keyboard.press('Escape')

  await mockApi.use('app-links-javascript-url')
  await page.goto('')
  await page.getByRole('button', { name: 'Apps menu' }).click()
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Helpdesk'])
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
})

test('US3-AS9 there is no apps menu without app links', async ({ page, mockApi }) => {
  await mockApi.use('app-links-none')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  await expect(page.getByRole('button', { name: /menu$/ }).filter({ hasText: 'Apps' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('button', { name: 'Apps menu' })).toHaveCount(0)
})

test('Edge: a 255-character username fits the header and the user menu at 360 px, with the full value available', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  const username = `${'a'.repeat(242)}@example.org`
  await mockApi.use('anonymous-default', {
    accounts: { [username]: { role: 'mailboxUser' } },
    signedInAs: username,
  })
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username)
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: `Account menu of ${username}` }).click()
  await expect(page.getByRole('menu')).toContainText(username)
  await expectNoHorizontalScroll()
})
