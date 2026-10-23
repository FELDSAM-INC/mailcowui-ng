import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation } from '../fixtures/flows'

test('sidebar sections collapse and scroll independently of the page', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('admin-active')
  await page.goto('domains')
  const navigation = await openNavigation(page)
  const email = navigation.locator('[data-nav-group="email"]')
  const disclosure = email.getByRole('button', { name: 'Email configuration', exact: true })
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await disclosure.click()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(email.getByRole('link', { name: 'Domains', exact: true })).toBeHidden()
  await disclosure.click()
  await expect(email.getByRole('link', { name: 'Domains', exact: true })).toBeVisible()
  const scroll = page.locator('[data-sidebar-scroll]')
  const before = await page.evaluate(() => window.scrollY)
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  // Expanding a section changes the scroll range; scroll only once layout has settled.
  await navigation.locator('[data-nav-item="globalFilterMaps"]').scrollIntoViewIfNeeded()
  await expect(navigation.locator('[data-nav-item="globalFilterMaps"]')).toBeInViewport()
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
  if (isNarrow(page))
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeInViewport()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.screenshot({ path: test.info().outputPath('sidebar.png') })
})

test('grouped tabs select templates and aliases while keeping page content equally wide', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('admin-active')
  for (const [path, labels] of [
    ['domains', ['Domains', 'Domain Templates']],
    ['mailboxes', ['Mailboxes', 'Mailbox Templates']],
    ['aliases', ['Aliases', 'Domain aliases']],
  ] as const) {
    await page.goto(path)
    const tabs = page.locator('[data-section-navigation]')
    await expect(tabs).toBeVisible()
    if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
    await expect(tabs.getByRole('link')).toHaveText([...labels])
    await tabs.getByRole('link', { name: labels[1], exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      tabs.getByRole('link', { name: labels[1], exact: true, includeHidden: true }),
    ).toHaveAttribute('aria-current', 'page')
    await expectNoHorizontalScroll()
  }
  for (const path of [
    'domains',
    'domains/-/new',
    'api-keys/new',
    'routing/transports/new',
    'system/ip-check',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    if (path === 'domains/-/new') {
      await expect(page.getByRole('heading', { level: 1, name: 'Add domain' })).toBeVisible()
      await expect(
        page.getByRole('textbox', { name: 'Domain (required)', exact: true }),
      ).toBeVisible()
    }
    const widths = await page.locator('[data-shell-content]').evaluate((shell) => {
      const root = shell.querySelector('[data-page-content]')?.firstElementChild
      return [shell.getBoundingClientRect().width, root?.getBoundingClientRect().width ?? 0]
    })
    expect(Math.abs(widths[0]! - widths[1]!), path).toBeLessThan(1)
    await expectNoHorizontalScroll()
  }
  await expectAccessible()
})

test('Access and Options show exact ordered tabs with available destinations', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('admin-active')
  for (const [path, expected] of [
    [
      'api-keys',
      [
        'Administrators',
        'Domain administrators',
        'API keys',
        'Identity Provider',
        'OAuth2 Apps',
        'Rspamd UI',
      ],
    ],
    [
      'dns/dkim-keys',
      [
        'ARC/DKIM keys',
        'Forwarding Hosts',
        'Fail2ban parameters',
        'Quota notifications',
        'Rspamd settings map',
        'Password Settings',
        'Customize',
      ],
    ],
  ] as const) {
    await page.goto(path)
    const tabs = page.locator('[data-section-navigation]')
    await expect(tabs).toBeVisible()
    if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
    await expect(tabs.getByRole('listitem')).toHaveCount(expected.length)
    const labels = await tabs.getByRole('listitem').evaluateAll((items) =>
      items.map((item) => {
        const copy = item.cloneNode(true) as HTMLElement
        copy.querySelectorAll('.sr-only').forEach((node) => node.remove())
        return copy.textContent?.trim()
      }),
    )
    expect(labels).toEqual([...expected])
    await expect(tabs.locator('[aria-disabled="true"]')).toHaveCount(0)
    await expect(tabs.getByRole('link')).toHaveCount(expected.length)
    await expectAccessible()
    await expectNoHorizontalScroll()
  }
})

test('Access gives Domain Administrators its second tab and keeps details selected', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('domain-admins-three')
  await page.goto('domains')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Access', exact: true }).click()
  await expect(page).toHaveURL(/\/administrators\/admins$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const tabs = page.locator('[data-section-navigation]')
  if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
  await tabs.getByRole('link', { name: 'Domain administrators', exact: true }).click()
  await expect(page.locator('[data-account-row]')).toHaveCount(3)
  await page.locator('[data-account-row]').first().getByRole('link').first().click()
  await expect(page.locator('#section-account')).toBeVisible()
  await expect(
    tabs.getByRole('link', {
      name: 'Domain administrators',
      exact: true,
      includeHidden: true,
    }),
  ).toHaveAttribute('aria-current', 'page')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('theme switch stays outside the username dropdown and language choices carry flags', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('admin-active', {
    accounts: {
      admin: { preferences: { language: 'en-gb', theme: 'light', etag: '"navigation-pref"' } },
    },
  })
  await page.goto('domains')
  await expect(page.getByRole('heading', { level: 1, name: 'Domains' })).toBeVisible()
  // The logo must fit the remaining header space when all three controls are present.
  const logo = await page.locator('header img, [data-sidebar-logo] img').boundingBox()
  const themeBox = await page.getByRole('switch', { name: 'Dark', exact: true }).boundingBox()
  expect(logo && themeBox && logo.x + logo.width <= themeBox.x).toBe(true)
  const theme = page.getByRole('switch', { name: 'Dark', exact: true })
  await expect(theme).toBeVisible()
  await theme.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect
    .poll(async () =>
      (await mockApi.requests())
        .filter((request) => request.operationId === 'updatePreferences')
        .map((request) => request.body),
    )
    .toEqual([{ theme: 'dark' }])
  await page.getByRole('button', { name: 'Account menu of admin' }).click()
  await expect(page.getByRole('menu').getByRole('menuitemradio', { name: 'Dark' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'User Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Passkeys', exact: true })).toBeVisible()
  const czech = page.getByRole('menuitemradio', { name: 'Čeština (Czech)', exact: true })
  await expect(czech).toBeHidden()
  await expect(page.locator('[data-current-language]')).toContainText('English')
  await page.locator('[data-language-submenu-trigger]').click()
  await expect(czech).toBeVisible()
  if (!isNarrow(page)) {
    const submenu = await page.locator('[data-language-submenu]').boundingBox()
    const trigger = await page.locator('[data-language-submenu-trigger]').boundingBox()
    expect(submenu && trigger && submenu.x + submenu.width < trigger.x).toBe(true)
  }
  await expect(czech.locator('[data-language-flag]')).toHaveText('🇨🇿')
  await czech.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  await expect(page.getByRole('heading', { level: 1, name: 'Domény' })).toBeVisible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Nabídka účtu admin' }).click()
  await expect(page.locator('[data-current-language]')).toContainText('Čeština')
  await page.locator('[data-language-submenu-trigger]').click()
  await expectAccessible()
  await expectTouchTargets()
  await page.screenshot({ path: test.info().outputPath('language-menu.png') })
})

test('TailAdmin desktop rail starts at the top and collapses beside the header', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  test.skip(isNarrow(page), 'desktop sidebar; mobile drawer covered separately')
  await mockApi.use('admin-active')
  await page.goto('domains')
  await expect(page.getByRole('heading', { level: 1, name: 'Domains' })).toBeVisible()
  const sidebar = page.locator('[data-desktop-sidebar]')
  const header = page.getByRole('banner')
  const expanded = await sidebar.boundingBox()
  const topbar = await header.boundingBox()
  expect(expanded?.y).toBe(0)
  expect(expanded?.width).toBe(290)
  expect(topbar?.x).toBe(expanded!.x + expanded!.width)
  await expect(header.locator('img')).toHaveCount(0)
  await expect(page.locator('[data-sidebar-logo] img')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(90)
  expect((await header.boundingBox())?.x).toBe(90)
  const access = sidebar.getByRole('link', { name: 'Access', exact: true })
  await access.click()
  await expect(page).toHaveURL(/\/administrators\/admins$/)
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.screenshot({ path: test.info().outputPath('collapsed-sidebar.png') })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'false')
  await page.screenshot({ path: test.info().outputPath('expanded-sidebar.png') })
})
