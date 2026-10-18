// The Phase 2 checkpoint (T048): the app boots against the mock with the strict CSP, renders the
// shell with the catalogue navigation for an active session, and handles "API not ready" and
// unknown addresses. Only routes that exist after Phase 2 are used: the generated placeholders and
// the catch-all.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

async function expectDomainsPlaceholder(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Domains' })).toBeVisible()
  await expect(page.getByText('This section comes in a later version of the app.')).toBeVisible()
}

test.describe('Edge: API not ready', () => {
  test('Edge: API not ready – a network failure shows the full-page message, and its retry recovers', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-active')
    await page.route('**/api/v2/**', (route) => route.abort())
    await page.goto('domains')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Service temporarily unavailable' }),
    ).toBeVisible()
    await expectAccessible()
    await page.unroute('**/api/v2/**')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expectDomainsPlaceholder(page)
  })

  test('Edge: API not ready – an HTML 502 from nginx shows the full-page message, and its retry recovers', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-active')
    await page.route('**/api/v2/**', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><body><h1>502 Bad Gateway</h1></body></html>',
      }),
    )
    await page.goto('domains')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Service temporarily unavailable' }),
    ).toBeVisible()
    await page.unroute('**/api/v2/**')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expectDomainsPlaceholder(page)
  })

  test('Edge: API not ready – the documented 500 of the session shows the full-page message, and its retry recovers', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bootstrap-500', { signedInAs: 'admin' })
    await page.goto('domains')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Service temporarily unavailable' }),
    ).toBeVisible()
    await mockApi.patch({ failures: { getSession: { status: 500, times: 0 } } })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expectDomainsPlaceholder(page)
  })
})

test.describe('the shell', () => {
  test('FR-042 FR-043 FR-046 an active administrator opening /ng/domains sees the shell, the navigation and the placeholder', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('admin-active')
    await page.goto('domains')
    await expectDomainsPlaceholder(page)
    await expect(page).toHaveTitle('Domains – Example Mail')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeAttached()
    await expect(page.getByText('Maintenance on Sunday 02:00–04:00 UTC.')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toContainText('Operated by Example Hosting.')
    await expectAccessible()
    await expectNoHorizontalScroll()

    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    if (isNarrow(page)) {
      await expect(navigation).toHaveCount(0)
      await expectTouchTargets()
      const menuButton = page.getByRole('button', { name: 'Toggle navigation' })
      await menuButton.click()
      const drawer = page.getByRole('dialog')
      await expect(drawer.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'API keys' })).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Spam filter' })).toHaveCount(0)
      await expectAccessible()
      await expectNoHorizontalScroll()
      await expectTouchTargets()
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(menuButton).toBeFocused()
      await menuButton.click()
      await page.getByRole('dialog').getByRole('link', { name: 'Mailboxes' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } else {
      await expect(navigation).toBeVisible()
      await expect(navigation.getByRole('link', { name: 'Domains' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(navigation.getByRole('link', { name: 'Spam filter' })).toHaveCount(0)
      await navigation.getByRole('link', { name: 'Mailboxes' }).click()
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeFocused()
    await expect(page).toHaveTitle('Mailboxes – Example Mail')

    const userMenu = page.getByRole('button', { name: 'Account menu of admin' })
    await userMenu.click()
    const menu = page.getByRole('menu')
    await expect(menu).toContainText('Administrator')
    await expect(menu.getByRole('menuitem', { name: 'Passkeys' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
    await expectAccessible()
    await page.keyboard.press('Escape')
  })

  test('FR-083 the shell has no horizontal scroll at 360 and 320 px in the dark theme', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-active', {
      accounts: { admin: { preferences: { language: 'en-gb', theme: 'dark', etag: '"p2"' } } },
    })
    await page.goto('domains')
    await expectDomainsPlaceholder(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expectNoHorizontalScroll()
  })
})

test.describe('not found', () => {
  test('Edge: an unknown address shows the not-found page with a link home', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-active')
    await page.goto('no/such/page')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveTitle('Page not found – Example Mail')
    const home = page.getByRole('main').getByRole('link', { name: 'Go to the home screen' })
    await expect(home).toHaveAttribute('href', '/ng/')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })
})
