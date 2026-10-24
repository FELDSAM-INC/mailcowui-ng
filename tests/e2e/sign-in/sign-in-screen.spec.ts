// T067: the sign-in screens (US1-AS1, AS14–AS16, FR-001–FR-009, FR-049 and the edge cases of the
// public configuration).
import { expect, test } from '../fixtures/test'
import { passwordForm } from '../fixtures/flows'

test.describe('the role-neutral sign-in screen', () => {
  test('US1-AS1 FR-001 FR-001a FR-049 it shows the logo, product name, announcement, help text and app links', async ({
    page,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await page.goto('')
    await expect(page).toHaveURL(/\/ng\/sign-in$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
    await expect(page).toHaveTitle('Login – Example Mail')
    const main = page.getByRole('main')
    await expect(main.locator('img[src*="/public-config/logos/light"]')).toBeVisible()
    if (page.viewportSize()!.width >= 1024)
      await expect(main.locator('[data-product-name]')).toBeHidden()
    else await expect(main.locator('[data-product-name]')).toBeVisible()
    await expect(page.getByText('Maintenance on Sunday 02:00–04:00 UTC.')).toBeVisible()
    // The help text sits behind the classic "Show/Hide help panel" disclosure (`start.help`).
    await expect(main.getByText('Need help? Write to')).toBeHidden()
    await main.getByText('Show/Hide help panel').click()
    await expect(main.getByText('Need help? Write to')).toBeVisible()
    const apps = main.getByRole('region', { name: 'Apps' })
    await expect(apps.getByRole('link')).toHaveText(['Webmail', 'Helpdesk'])
    await expect(apps.getByRole('link', { name: 'Helpdesk' })).toHaveAttribute(
      'href',
      'https://helpdesk.example.org/',
    )
    await expect(page.getByRole('contentinfo')).toContainText('Operated by Example Hosting.')
    await expect(passwordForm(page).username).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('FR-001 the dark theme shows the dark logo', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('sign-in')
    await expect(
      page.getByRole('main').locator('img[src*="/public-config/logos/dark"]'),
    ).toBeVisible()
  })

  test('FR-003 without the public configuration the neutral defaults apply and sign-in works', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('config-unavailable')
    await page.goto('sign-in')
    await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
    await expect(page).toHaveTitle('Login – localhost')
    const main = page.getByRole('main')
    await expect(main.getByText('localhost', { exact: true })).toBeVisible()
    await expect(main.locator('img')).toHaveCount(0)
    await expect(page.locator('[data-announcement]')).toHaveCount(0)
    await expect(main.getByRole('region', { name: 'Apps' })).toHaveCount(0)
    await expect(page.getByRole('contentinfo')).toHaveCount(0)
    await expect(passwordForm(page).submit).toBeEnabled()
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('Edge: a logo that fails to load leaves the product name in its place', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('logo-broken')
    await page.goto('sign-in')
    const main = page.getByRole('main')
    await expect(main.getByText('Example Mail', { exact: true })).toBeVisible()
    await expect(main.locator('img')).toHaveCount(0)
    await expectAccessible()
  })

  test('FR-002 hostile operator content is neutralised and safe formatting is kept', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('help-html-malicious')
    await page.goto('sign-in')
    const main = page.getByRole('main')
    await main.getByText('Show/Hide help panel').click()
    await expect(
      main.getByText('<img src=x onerror=alert(1)>Example', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('<script>alert(1)</script>Read me')).toBeVisible()
    await expect(main.getByRole('link', { name: 'good' })).toHaveAttribute(
      'href',
      'https://example.org/help',
    )
    await expect(main.getByRole('link', { name: 'good' })).toHaveAttribute(
      'rel',
      'noopener noreferrer nofollow',
    )
    await expect(main.getByText('bad', { exact: true })).toBeVisible()
    await expect(main.getByRole('link', { name: 'bad' })).toHaveCount(0)
    await expect(
      page.locator('main script, main iframe, main img[src*="evil"], form[action*="evil"]'),
    ).toHaveCount(0)
    await expect(page.locator('[onclick]')).toHaveCount(0)
    await expect(main.getByRole('region', { name: 'Apps' }).getByRole('link')).toHaveText([
      'Webmail',
      'Helpdesk',
    ])
    const footer = page.getByRole('contentinfo')
    await expect(footer.locator('b')).toHaveText('Footer')
    await expect(footer.locator('input, form, style')).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-009 the role-neutral screen links to the password reset (UI 005: in the app)', async ({
    page,
  }) => {
    await page.goto('sign-in')
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveAttribute(
      'href',
      '/ng/reset-password/request',
    )
  })

  test('Edge: a 255-character product name wraps without horizontal scrolling', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    const name = 'Mail'.repeat(63) + 'Box'
    await mockApi.use('anonymous-default', { publicConfig: { productName: name } })
    await page.goto('sign-in')
    await expect(page.getByRole('main').getByText(name)).toBeVisible()
    await expectNoHorizontalScroll()
  })
})

test.describe('role screens and login page options', () => {
  test('US1-AS14 FR-005 FR-006 role links follow the login page options, and a role screen names its role', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('hidden-admin-link')
    await page.goto('sign-in')
    const others = page.getByRole('navigation', { name: 'Not the correct login?' })
    await expect(others.getByRole('link')).toHaveText(['Log in as domain admin', 'Log in as user'])
    await expect(page.getByRole('link', { name: 'Log in as admin' })).toHaveCount(0)

    await page.goto('sign-in/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Administrator Login' })).toBeVisible()
    await expect(page).toHaveTitle('Administrator Login – Example Mail')
    const fromAdmin = page.getByRole('navigation', { name: 'Not the correct login?' })
    await expect(fromAdmin.getByRole('link')).toHaveText([
      'Sign in with any account',
      'Log in as domain admin',
      'Log in as user',
    ])
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()

    await fromAdmin.getByRole('link', { name: 'Log in as domain admin' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Domain-Administrator Login' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Log in as user' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'User Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible()
  })

  test('US1-AS15 FR-007 UI 012 FR-041 force single sign-on without single sign-on keeps the password form', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('force-sso')
    await page.goto('sign-in')
    await expect(passwordForm(page).username).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Single Sign-On' })).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.goto('sign-in/mailbox-user')
    await expect(passwordForm(page).username).toBeVisible()
  })

  test('Edge: force single sign-on on a device without passkeys keeps the password form when single sign-on is not offered', async ({
    page,
    mockApi,
    webauthn,
    expectAccessible,
  }) => {
    await webauthn.withoutPasskeySupport()
    await mockApi.use('force-sso')
    await page.goto('sign-in')
    await expect(passwordForm(page).username).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Not the correct login?' }).getByRole('link'),
    ).toHaveText(['Log in as admin', 'Log in as domain admin', 'Log in as user'])
    await expectAccessible()
  })

  test('US1-AS16 FR-008 UI 012 FR-042 no identity-provider hint is shown', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-configured')
    await page.goto('sign-in')
    await expect(passwordForm(page).username).toBeVisible()
    await expect(page.getByRole('note')).toHaveCount(0)
    await expect(page.getByText('cannot use their password here yet')).toHaveCount(0)
    await page.goto('sign-in/admin')
    await expect(page.getByRole('note')).toHaveCount(0)
    await expectAccessible()
  })
})
