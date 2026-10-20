import { expectLanding, submitPassword } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

test('US5 overview preserves legacy storage, protocols, aliases and recovery address', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox-no-imap')
  await page.goto('account')
  const overview = page.locator('[data-mailbox-overview]')
  await expect(overview.locator('[data-mailbox-address]')).toHaveText('anna@example.org')
  await expect(overview.locator('[data-quota-usage]')).toContainText('256 MiB / 1 GiB')
  await expect(overview.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  await expect(overview).toContainText('1,234 messages')
  await expect(overview.locator('[data-protocol-access]')).toContainText('IMAP: not allowed')
  await expect(overview.locator('[data-protocol-access]')).toContainText('SMTP: allowed')
  await expect(overview).toContainText('a.novak@example.org')
  await expect(overview).toContainText('anna@example.com')
  await expect(overview).toContainText('sales@example.org — Sales team')
  await expect(overview).toContainText('info@example.org')
  await expect(overview).toContainText('anna.private@example.net')
  await expect(overview).not.toContainText('Anna Novak')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US5 unlimited quota and recovery email remain readable without editing flags', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox-unlimited-quota')
  await page.goto('account')
  await expect(page.locator('[data-quota-usage]')).toContainText('256 MiB / ∞')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expectAccessible()
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account')
  await expect(page.locator('[data-mailbox-overview]')).toContainText('anna.private@example.net')
  await expect(page.locator('[data-sections]')).not.toContainText('Password recovery email')
})

test('US5 storage formats follow Czech locale', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox', {
    accounts: {
      'anna@example.org': { preferences: { language: 'cs-cz', theme: 'light', etag: '"p"' } },
    },
  })
  await page.goto('account')
  await expect(page.locator('[data-quota-usage]')).toContainText('1\u00a0234')
  await expect(page.locator('[data-quota-usage]')).toContainText('256 MiB / 1 GiB')
})

test('US5 opens the reserved webmail tab with its legacy cookie and no opener', async ({
  page,
  context,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await context.route('**/SOGo/so/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Webmail</title><p>Webmail opened</p>',
    }),
  )
  await page.goto('account')
  const popupPromise = page.waitForEvent('popup')
  await page
    .locator('[data-webmail-action]')
    .getByRole('button', { name: 'Webmail', exact: true })
    .click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/SOGo\/so\/$/)
  expect(await popup.evaluate(() => window.opener === null)).toBe(true)
  const cookie = (await context.cookies()).find((item) => item.name === 'MCSESSID')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.path).toBe('/')
  await popup.close()
  expect(await mockApi.countRequests('createWebmailHandOff')).toBe(1)
})

test('US5 a blocked popup offers a safe link and a failed request closes the blank tab', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox')
  await page.addInitScript(() => {
    window.open = () => null
  })
  await page.goto('account')
  const action = page.locator('[data-webmail-action]')
  await action.getByRole('button', { name: 'Webmail', exact: true }).click()
  await expect(action).toContainText('The browser blocked the new tab.')
  await expect(action.getByRole('link', { name: 'Webmail', exact: true })).toHaveAttribute(
    'href',
    '/SOGo/so/',
  )
  await expect(action.getByRole('link', { name: 'Webmail', exact: true })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  await expectAccessible()

  // Observe close without depending on browser-specific about:blank popup event timing.
  await page.evaluate(() => {
    Object.assign(window, { __blankClosed: false })
    window.open = () =>
      ({
        opener: window,
        close: () => Object.assign(window, { __blankClosed: true }),
        location: {
          replace: () => {
            throw new Error('Unexpected navigation')
          },
        },
      }) as unknown as Window
  })
  await mockApi.failNext('createWebmailHandOff', { status: 503, type: 'temporary-failure' })
  await action.getByRole('button', { name: 'Webmail', exact: true }).click()
  await expect(action.getByRole('alert')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__blankClosed'))).toBe(true)
  await expect(action.getByRole('link')).toHaveCount(0)
})

for (const scenario of ['account-groupware-disabled', 'account-mailbox-impersonated']) {
  test(`US5 hides the webmail action for ${scenario}`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use(scenario)
    await page.goto('account')
    await expect(page.locator('[data-mailbox-address]')).toBeVisible()
    await expect(page.locator('[data-webmail-action]')).toHaveCount(0)
    await expectAccessible()
    expect(await mockApi.countRequests('createWebmailHandOff')).toBe(0)
  })
}

test('US5 the mailbox default landing shows the overview and offers webmail', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('')
  await expectLanding(page, 'mailboxUser')
  const card = page.locator('[data-mailbox-overview]')
  await expect(card).toContainText('256 MiB / 1 GiB')
  await expect(card.getByRole('button', { name: 'Webmail', exact: true })).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expect(page.locator('[data-mailbox-address]')).toBeVisible()
  expect(await mockApi.countRequests('getOwnMailboxOverview')).toBe(1)
})

test('US5 default sign-in forwards in the same tab, while a deep link returns to its page', async ({
  page,
  context,
  mockApi,
}) => {
  await context.route('**/SOGo/so/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Webmail</title><p>Webmail opened</p>',
    }),
  )
  await mockApi.use('account-mailbox-webmail-redirect')
  await page.goto('')
  await submitPassword(page, 'anna@example.org')
  await expect(page).toHaveURL(/\/SOGo\/so\/$/)
  expect(context.pages()).toHaveLength(1)
  expect(await mockApi.countRequests('createWebmailHandOff')).toBe(1)

  await mockApi.use('account-mailbox-webmail-redirect')
  await page.goto('account/app-passwords')
  await submitPassword(page, 'anna@example.org')
  await expect(page).toHaveURL(/\/ng\/account\/app-passwords$/)
  expect(await mockApi.countRequests('createWebmailHandOff')).toBe(0)
})

test('US5 a forwarding failure lands on User Settings with an announcement', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox-webmail-redirect')
  await mockApi.failNext('createWebmailHandOff', { status: 500 })
  await page.goto('')
  await submitPassword(page, 'anna@example.org')
  await expectLanding(page, 'mailboxUser')
  await expect(page.locator('[data-mailbox-overview]')).toBeVisible()
  await expect(page.locator('[data-live="assertive"]')).toContainText(
    'Webmail could not be opened.',
  )
})

test('US5 reauthentication returns to User Settings without applying the forwarding preference', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox-webmail-redirect', {
    signedInAs: 'anna@example.org',
    idleTimeout: 150,
  })
  await page.clock.install()
  await page.goto('')
  await expectLanding(page, 'mailboxUser')
  await expect(page.locator('[data-mailbox-overview]')).toBeVisible()
  await mockApi.patch({ expireSession: true })
  await page.clock.fastForward('03:00')
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await submitPassword(page, 'anna@example.org')
  await expectLanding(page, 'mailboxUser')
  await expect(page.locator('[data-mailbox-overview]')).toBeVisible()
  expect(await mockApi.countRequests('createWebmailHandOff')).toBe(0)
})
