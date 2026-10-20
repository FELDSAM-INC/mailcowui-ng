// T147: account screens at WCAG's 320 CSS px reflow size (1280 px at 400% zoom),
// short landscape viewports, reduced motion, and the main keyboard paths.
import type { Locator, Page } from '@playwright/test'
import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { totpCode } from '../../support/totp'
import { expect, test } from '../fixtures/test'

const SCREENS = [
  ['default landing', 'account-mailbox', '', '[data-mailbox-overview]'],
  ['account', 'account-mailbox', 'account', '[data-sections]'],
  ['password', 'account-mailbox', 'account/password', 'input[autocomplete="current-password"]'],
  ['recovery', 'account-mailbox', 'account/recovery-email', 'input[type="email"]'],
  ['second factors', 'account-mailbox', 'account/two-factor', '[data-second-factors]'],
  [
    'authenticator setup',
    'account-two-factor-empty',
    'account/two-factor/add/totp',
    '[data-grouped-secret]',
  ],
  [
    'security key setup',
    'account-two-factor-empty',
    'account/two-factor/add/webauthn',
    'input[autocomplete="current-password"], [data-webauthn-unsupported]',
  ],
  [
    'Yubico setup',
    'account-two-factor-empty',
    'account/two-factor/add/yubi-otp',
    'input[autocomplete="current-password"]',
  ],
  ['app passwords', 'account-mailbox', 'account/app-passwords', '[data-entry]'],
  ['add app password', 'account-mailbox', 'account/app-passwords/new', 'form input'],
  ['edit app password', 'account-mailbox', 'account/app-passwords/1', 'form input'],
  ['temporary aliases', 'account-mailbox', 'account/temporary-aliases', 'input[type="search"]'],
  ['mail settings', 'account-mailbox', 'account/mail-settings', '[data-tls-warning]'],
  ['Pushover', 'pushover-configured', 'account/push-notifications', 'input[name="token"]'],
  ['recent logins', 'account-mailbox', 'account/recent-logins', '[data-login]'],
  ['mail setup', 'account-mailbox', 'account/mail-apps', '[data-profile-password="true"]'],
  [
    'forced password',
    'account-forced-password-policy',
    'account',
    'input[autocomplete="new-password"]',
  ],
  ['forced second factor', 'forced-second-factor', 'account', '[data-forced-second-factor]'],
  ['reset request', 'account-password-reset', 'reset-password/request', 'form input'],
  [
    'reset password',
    'account-password-reset',
    'reset-password#token=3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7',
    '[data-reset-password]',
  ],
  [
    'mailbox app passwords',
    'account-admin',
    'mailboxes/anna@example.org/app-passwords',
    '[data-entry]',
  ],
  [
    'mailbox aliases',
    'account-admin',
    'mailboxes/anna@example.org/temporary-aliases',
    'input[type="search"]',
  ],
  [
    'mailbox connections',
    'account-admin',
    'mailboxes/anna@example.org/recent-logins',
    '[data-login]',
  ],
  [
    'mailbox resets',
    'account-admin',
    'mailboxes/anna@example.org/mail-settings',
    '[data-reset-groupware]',
  ],
  ['personal Sieve script', 'account-active-script', 'account/filters', 'pre'],
  ['Sieve filter list', 'filters-many', 'filters', '[data-filter-id]'],
  [
    'mailbox Sieve filters',
    'filters-many',
    'mailboxes/anna@example.org/filters',
    '[data-filter-id]',
  ],
  ['add Sieve filter', 'filters-many', 'filters/new', '#filter-script'],
  ['edit Sieve filter', 'filters-many', 'filters/1', '#filter-description'],
] as const

async function assertMotion(page: Page) {
  const longest = await page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('*')].flatMap((element) => {
        const style = getComputedStyle(element)
        return [style.transitionDuration, style.animationDuration].flatMap((value) =>
          value.split(',').map((part) => parseFloat(part) || 0),
        )
      }),
    ),
  )
  expect(longest).toBeLessThanOrEqual(0.001)
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 100; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
  // The focused control must be in view and not covered by the fixed shell or save bar.
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const hit = document.elementFromPoint(x, y)
        return (
          y >= 0 &&
          y < innerHeight &&
          hit !== null &&
          (element.contains(hit) || hit.contains(element))
        )
      }),
    )
    .toBe(true)
  const visibleFocus = await target.evaluate((element) => {
    const style = getComputedStyle(element)
    return (
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
      style.boxShadow !== 'none'
    )
  })
  expect(visibleFocus, 'keyboard focus has a visible indicator').toBe(true)
}

for (const [name, scenario, path, ready] of SCREENS) {
  test(`${name}: reflow, landscape and reduced motion`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(path)
    await expect(page.locator(ready).first()).toBeVisible()
    await expectNoHorizontalScroll(page, { widths: [320] })
    await page.setViewportSize({ width: 320, height: 225 })
    await expectNoHorizontalScroll(page, { widths: [320] })
    await page.setViewportSize({ width: 780, height: 360 })
    await expectNoHorizontalScroll(page, { widths: [780] })
    await assertMotion(page)
  })
}

test('US1 password change works with the keyboard and keeps focus visible', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/password')
  const next = page.getByLabel('New password', { exact: true })
  await expect(next).toBeVisible()
  await tabTo(page, next)
  await page.keyboard.type('Keyboard-Password-71')
  await tabTo(page, page.getByLabel('Confirmation password (repeat)'))
  await page.keyboard.type('Keyboard-Password-71')
  await tabTo(page, page.getByLabel('Current password (confirm changes)'))
  await page.keyboard.type(MOCK_PASSWORD)
  await tabTo(
    page,
    page.locator('form').getByRole('button', { name: 'Change password', exact: true }),
  )
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-password-changed]')).toBeVisible()
})

test('US2 TOTP setup works with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  const secret = page.locator('[data-grouped-secret]')
  await expect(secret).toBeVisible()
  const key = (await secret.innerText()).replace(/[\s,]/g, '')
  await tabTo(page, page.getByLabel('An identifier for your key'))
  await page.keyboard.type('Keyboard authenticator')
  await tabTo(page, page.getByLabel('Current password (confirm changes)'))
  await page.keyboard.type(MOCK_PASSWORD)
  await tabTo(page, page.getByLabel('Six-digit code'))
  await page.keyboard.type(totpCode(key, Date.now()))
  await tabTo(page, page.getByRole('button', { name: 'Confirm', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-second-factors]')).toContainText('Keyboard authenticator')
})

test('US3 password reset works with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('account-password-reset')
  await page.goto('reset-password#token=3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7')
  const next = page.getByLabel('New Password', { exact: true })
  await expect(next).toBeVisible()
  await tabTo(page, next)
  await page.keyboard.type('Keyboard-Reset-91')
  await tabTo(page, page.getByLabel('Confirm new password'))
  await page.keyboard.type('Keyboard-Reset-91')
  await tabTo(page, page.getByRole('button', { name: 'Reset Password', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-reset-done]')).toBeVisible()
})

test('US4 app password creation and secret dialog work with the keyboard at 320 px', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-app-passwords-empty')
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    }),
  )
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('account/app-passwords/new')
  const name = page.getByLabel('App name', { exact: true })
  await expect(name).toBeVisible()
  await tabTo(page, name)
  await page.keyboard.type('Keyboard app')
  await tabTo(page, page.getByRole('button', { name: 'Add', exact: true }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'App password', exact: true })
  await expect(dialog).toBeVisible()
  await expectNoHorizontalScroll()
  await tabTo(page, dialog.getByRole('button', { name: 'Copy', exact: true }))
  await page.keyboard.press('Enter')
  await tabTo(page, dialog.getByRole('button', { name: 'Close', exact: true }))
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
})

test('settings warnings are exposed and both reset confirmations reflow at 320 px', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox')
  await page.setViewportSize({ width: 320, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('account/mail-settings')
  await expect(page.locator('[data-tls-warning]')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="sogo-reset-title"] > div')).toBeVisible()
  for (const selector of ['[data-reset-activesync]', '[data-reset-groupware]']) {
    await page.locator(selector).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expectNoHorizontalScroll()
    await assertMotion(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.locator(selector)).toBeFocused()
  }
})

for (const last of [false, true]) {
  test(`second-factor ${last ? 'disable' : 'remove'} dialog reflows at 320 px with reduced motion`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(last ? 'account-two-factor-single-active' : 'account-two-factor-two-active')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 780 })
    await page.goto('account/two-factor')
    const rows = page.locator('[data-second-factors] > li')
    await rows
      .nth(last ? 0 : 1)
      .getByRole('button', { name: /^Remove/ })
      .click()
    const dialog = page.getByRole(last ? 'dialog' : 'alertdialog')
    await expect(dialog).toBeVisible()
    await expectNoHorizontalScroll()
    await page.setViewportSize({ width: 320, height: 225 })
    await expectNoHorizontalScroll()
    await assertMotion(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
}

test('alias generation and its bulk removal confirmation reflow at 320 px', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('temporary-aliases-many')
  await page.setViewportSize({ width: 320, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('account/temporary-aliases?sort=address')
  await page.getByText('Generate random alias', { exact: true }).click()
  await expect(page.getByLabel('Period of validity', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'alias01@example.org', exact: true }).check()
  await page.getByRole('checkbox', { name: 'alias02@example.org', exact: true }).check()
  await page.locator('[data-bulk-bar]').getByRole('button', { name: 'Remove', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('alias01@example.org')
  await expect(dialog).toContainText('alias02@example.org')
  await expect(dialog.getByLabel('Type 2 to confirm')).toBeVisible()
  await expectNoHorizontalScroll()
  await assertMotion(page)
})

test('Pushover removal confirmation reflows without exposing its credentials', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('pushover-configured')
  await page.setViewportSize({ width: 320, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('account/push-notifications')
  await page
    .locator('[data-push-form]')
    .getByRole('button', { name: 'Remove', exact: true })
    .click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expectNoHorizontalScroll()
  await assertMotion(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
