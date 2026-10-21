import { expect, test } from '../../fixtures/test'

const path = 'system/customize/app-links'
test('T079 adds and edits a custom link, previews username and refreshes Apps immediately', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('[data-add-link]').click()
  await expect(page.locator('#app-link-3-name')).toBeFocused()
  await page.locator('#app-link-3-name').pressSequentially('Helpdesk')
  await expect(page.locator('#app-link-3-name')).toHaveValue('Helpdesk')
  await page.locator('#app-link-3-url').fill('https://help.example.org')
  await page.locator('#app-link-3-signedInUrl').fill('https://help.example.org/?u=%u')
  await expect(page.locator('[data-app-link="3"] [data-link-preview]')).toContainText(
    'https://help.example.org/?u=admin',
  )
  await page.locator('#app-link-3-showOnLoginPage').check()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  await page.getByRole('button', { name: 'Apps menu', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Helpdesk', exact: true })).toHaveAttribute(
    'href',
    'https://help.example.org/?u=admin',
  )
  await page.keyboard.press('Escape')
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateAppLinkSettings')
  expect(writes[0]!.body).toMatchObject({
    links: [
      { name: 'App 1' },
      { name: 'App 2' },
      { name: 'App 3' },
      { name: 'Helpdesk', showOnLoginPage: false },
    ],
  })
  await expectAccessible()
})

test('T079 validates every URL before sending and maps indexed errors', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#app-link-0-url').fill('javascript:alert(1)')
  await page.locator('#app-link-1-signedInUrl').fill('//evil.example')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#app-link-0-url')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#app-link-1-signedInUrl')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updateAppLinkSettings')).toBe(0)
  await section.locator('a[href="#app-link-0-url"]').click()
  await expect(page.locator('#app-link-0-url')).toBeFocused()
  await expectAccessible()
  await page.locator('#app-link-0-url').fill('/help')
  await page.locator('#app-link-1-signedInUrl').fill('')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
})

test('T079 reorders third to first with labelled touch and keyboard actions and saves the whole order', async ({
  page,
  mockApi,
}, testInfo) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  const move = page.getByRole('button', { name: 'Move up: App 3', exact: true })
  if (testInfo.project.use.hasTouch) await move.tap()
  else await move.click()
  await expect(page.getByRole('button', { name: 'Move up: App 3', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#app-link-0-name')).toHaveValue('App 3')
  await expect(page.locator('[aria-live=polite]')).toContainText('position 1 of 3')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateAppLinkSettings')
  expect((writes[0]!.body as { links: { name: string }[] }).links.map((link) => link.name)).toEqual(
    ['App 3', 'App 1', 'App 2'],
  )
})

test('T079 built-ins are read-only, include Webmail without groupware and adapt to width', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}, testInfo) => {
  await mockApi.use('app-links-three')
  await mockApi.patch({ selfService: { groupwareEnabled: false } })
  await page.goto(path)
  const built = page.locator('[data-built-in-links]')
  await expect(built).toContainText('Webmail')
  await expect(built).toContainText('cannot be modified')
  await expect(built.locator('input,button')).toHaveCount(0)
  await expect(page.locator('#section-app-links [data-link-table]')).toBeVisible({
    visible: testInfo.project.name === 'desktop-chromium',
  })
  await expect(page.locator('#section-app-links [data-link-cards]')).toBeVisible({
    visible: testInfo.project.name !== 'desktop-chromium',
  })
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
})

test('T079 exactly 50 links disable adding but removal makes room', async ({ page, mockApi }) => {
  await mockApi.use('app-links-50')
  await page.goto(path)
  await page
    .locator('#section-app-links')
    .getByRole('button', { name: /^Edit / })
    .click()
  await expect(page.locator('[data-add-link]')).toBeDisabled()
  await expect(page.locator('#app-link-limit')).toContainText('50 of 50')
  await page.locator('[data-remove="49"]').click()
  await expect(page.locator('[data-add-link]')).toBeEnabled()
  await expect(page.locator('[data-app-link]')).toHaveCount(49)
})

test('T079 unsaved removal asks before leaving and preserves the draft', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  await page
    .locator('#section-app-links')
    .getByRole('button', { name: /^Edit / })
    .click()
  await page.locator('[data-remove="1"]').click()
  const nav = page.getByRole('navigation', { name: 'Customize', exact: true })
  if (await nav.getByRole('button').isVisible()) await nav.getByRole('button').click()
  await nav.getByRole('link', { name: 'Change logo', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /stay|keep/i })
    .click()
  await expect(page.locator('[data-app-link]')).toHaveCount(2)
  expect(await mockApi.countRequests('updateAppLinkSettings')).toBe(0)
  await page
    .locator('#section-app-links')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#section-app-links form')).toHaveCount(0)
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateAppLinkSettings')
  expect((writes[0]!.body as { links: { name: string }[] }).links.map((link) => link.name)).toEqual(
    ['App 1', 'App 3'],
  )
})

test('T079 stale ordered lists keep local entries until an explicit retry', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#app-link-0-name').fill('My draft')
  const other = await context.newPage()
  await other.goto(path)
  const otherSection = other.locator('#section-app-links')
  await otherSection.getByRole('button', { name: /^Edit / }).click()
  await other.locator('#app-link-0-name').fill('Saved elsewhere')
  await otherSection.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(otherSection.locator('form')).toHaveCount(0)
  await other.close()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-outdated]')).toContainText('Saved elsewhere')
  await expect(page.locator('#app-link-0-name')).toHaveValue('My draft')
  expect(await mockApi.countRequests('updateAppLinkSettings')).toBe(2)
  await section.locator('[data-outdated]').scrollIntoViewIfNeeded()
  await expectAccessible()
  await section.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
})

test('T079 demo mode disables editing and a server outage preserves input', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto(path)
  await expect(page.locator('[data-demo-mode]')).toBeVisible()
  await expect(page.locator('main').getByRole('button', { name: /^Edit / })).toHaveCount(0)
  await expectAccessible()
  await mockApi.use('app-links-three')
  await page.reload()
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#app-link-0-name').fill('Kept after failure')
  await mockApi.failNext('updateAppLinkSettings', { status: 503 })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[role=alert]')).toBeVisible()
  await expect(page.locator('#app-link-0-name')).toHaveValue('Kept after failure')
  await mockApi.delay('updateAppLinkSettings', 500)
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(section.locator('form')).toHaveCount(0)
  expect(await mockApi.countRequests('updateAppLinkSettings')).toBe(2)
})

test('T079 stored long names stay literal and relative URL help remains visible', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('app-links-three')
  await page.goto(path)
  const section = page.locator('#section-app-links')
  await section.getByRole('button', { name: /^Edit / }).click()
  const name = '<b>' + 'x'.repeat(248) + '</b>'
  await page.locator('#app-link-0-name').fill(name)
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  const savedHeading = section.getByRole('heading', { name: 'App links', exact: true })
  await expect(savedHeading).toBeFocused()
  await expect(section).toContainText(name)
  await expect(section.locator('b')).toHaveCount(0)
  await expect(page.locator('main')).toContainText('one / on this mailcow host')
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  // Resizing after the saved section receives focus can leave a full-size tab trigger partly
  // behind the sticky header. Check actual target sizes and scan with the controls unobscured.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(savedHeading).toBeFocused()
  await expectTouchTargets()
  await expectAccessible()
  const tabs = page.getByRole('navigation', { name: 'Customize', exact: true })
  const trigger = tabs.getByRole('button', { name: 'App links', exact: true })
  if (await trigger.isVisible()) {
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(tabs.getByRole('link', { name: 'App links', exact: true })).toBeVisible()
    await page.keyboard.press('Space')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toBeFocused()
  }
})
