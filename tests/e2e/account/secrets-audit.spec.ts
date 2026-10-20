// T146: completed account flows must leave no credentials in persistent browser surfaces.
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { totpCode } from '../../support/totp'
import { expect, test } from '../fixtures/test'

const LOCAL_KEYS = [
  'mailcowui-ng.locale',
  'mailcowui-ng.theme',
  'mailcowui-ng.passkey-suggestion-dismissed',
]
const SESSION_KEYS = ['mailcowui-ng.announcement-collapsed', 'mailcowui-ng.sso-return-to']

function audit(page: Page) {
  const messages: string[] = []
  page.on('console', (message) => messages.push(message.text()))
  page.on('pageerror', (error) => messages.push(error.message))
  return async (secrets: string[]) => {
    const snapshot = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
      url: location.href,
      state: history.state,
      title: document.title,
    }))
    for (const key of Object.keys(snapshot.local)) expect(LOCAL_KEYS).toContain(key)
    for (const key of Object.keys(snapshot.session)) expect(SESSION_KEYS).toContain(key)
    const serialized = JSON.stringify([snapshot, messages])
    for (const secret of secrets) {
      expect(secret.length).toBeGreaterThan(0)
      expect(serialized).not.toContain(secret)
    }
  }
}

for (const forced of [false, true]) {
  test(`US1 ${forced ? 'forced' : 'own'} password leaves no stored secret`, async ({
    page,
    mockApi,
  }) => {
    const check = audit(page)
    const next = 'Account-audit-8F9q'
    await mockApi.use(forced ? 'account-forced-password-policy' : 'account-mailbox')
    await page.goto(forced ? 'account' : 'account/password')
    await page.getByLabel('New password', { exact: true }).fill(next)
    await page.getByLabel('Confirmation password (repeat)').fill(next)
    if (!forced) await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
    await check([next, MOCK_PASSWORD])
    await page
      .locator('form')
      .getByRole('button', { name: forced ? 'Save changes' : 'Change password', exact: true })
      .click()
    if (forced) await expect(page).toHaveURL(/\/ng\/account\/password$/)
    else await expect(page.locator('[data-password-changed]')).toBeVisible()
    await check([next, MOCK_PASSWORD])
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await check([next, MOCK_PASSWORD])
  })
}

test('US2 TOTP key, provisioning URI and verification code stay out of storage and history', async ({
  page,
  mockApi,
}) => {
  const check = audit(page)
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  const key = page.locator('[data-grouped-secret]')
  await expect(key).toBeVisible()
  const secret = (await key.innerText()).replace(/[\s,]/g, '')
  const uri = await page
    .getByRole('link', { name: 'Open in authenticator app' })
    .getAttribute('href')
  const code = totpCode(secret, Date.now())
  await page.getByLabel('An identifier for your key').fill('Audit authenticator')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByLabel('Six-digit code').fill(code)
  await check([secret, uri!, code, MOCK_PASSWORD])
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.locator('[data-second-factors]')).toContainText('Audit authenticator')
  await expect(key).toHaveCount(0)
  await check([secret, uri!, code, MOCK_PASSWORD])
})

test('US2 Yubico credentials are cleared after enrolment', async ({ page, mockApi }) => {
  const check = audit(page)
  const apiKey = 'YubicoAuditPrivateKey55'
  const otp = 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf'
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/yubi-otp')
  await page.getByLabel('An identifier for your Device').fill('Audit Yubikey')
  await page.getByLabel('Yubico API ID').fill('12345')
  await page.getByLabel('Yubico API Key').fill(apiKey)
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByLabel('Touch Yubikey').fill(otp)
  await check([apiKey, otp, MOCK_PASSWORD])
  await page.getByLabel('Touch Yubikey').press('Enter')
  await expect(page.locator('[data-second-factors]')).toContainText('Audit Yubikey')
  await check([apiKey, otp, MOCK_PASSWORD])
})

test('US3 reset token and new password leave no browser trace after completion', async ({
  page,
  mockApi,
}) => {
  const check = audit(page)
  const token = '3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7'
  const password = 'Reset-audit-49Qw'
  await mockApi.use('account-password-reset')
  await page.goto(`reset-password#token=${token}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await check([token])
  await page.getByLabel('New Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm new password').fill(password)
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await check([token, password])
  await page.locator('[data-reset-done]').getByRole('link', { name: 'Login' }).click()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-reset-invalid]')).toBeVisible()
  await check([token, password])
})

test('US4 generated app password is forgotten after its one-time dialog closes', async ({
  page,
  mockApi,
}) => {
  const check = audit(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await mockApi.use('account-app-passwords-empty')
  await page.goto('account/app-passwords/new')
  await page.getByLabel('App name', { exact: true }).fill('Audit app')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'App password', exact: true })
  const secret = await dialog.getByLabel('Secret', { exact: true }).inputValue()
  await check([secret])
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('main')).not.toContainText(secret)
  await check([secret])
  await page.reload()
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('Audit app')
  await check([secret])
})

test('US7 Pushover credentials are write-only after save and reload', async ({ page, mockApi }) => {
  const check = audit(page)
  const token = 'AuditToken'.repeat(3)
  const userKey = 'AuditUserK'.repeat(3)
  await mockApi.use('pushover-unconfigured')
  await page.goto('account/push-notifications')
  const tokenInput = page.locator('input[name="token"]')
  const userInput = page.locator('input[name="userKey"]')
  await tokenInput.fill(token)
  await userInput.fill(userKey)
  await check([token, userKey])
  await page.locator('[data-push-form] button[type="submit"]').click()
  await expect(tokenInput).toHaveValue('')
  await expect(userInput).toHaveValue('')
  await check([token, userKey])
  await page.reload()
  await expect(tokenInput).toHaveValue('')
  await expect(userInput).toHaveValue('')
  await check([token, userKey])
})

test('US9 a downloaded Apple profile never persists its embedded password in the app', async ({
  page,
  mockApi,
}) => {
  const check = audit(page)
  await mockApi.use('account-mailbox')
  await page.goto('account/mail-apps')
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/me/mailbox/apple-profile') &&
      response.request().method() === 'POST',
  )
  const downloadPromise = page.waitForEvent('download')
  await page.locator('[data-profile-password="true"] [data-variant="email"]').click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const download = await downloadPromise
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  if (!path) throw new Error('The downloaded profile has no file')
  const xml = await readFile(path, 'utf8')
  const password = /<key>IncomingPassword<\/key><string>([^<]+)<\/string>/.exec(xml)?.[1]
  if (!password) throw new Error('The downloaded profile does not contain an incoming password')
  expect(password).toHaveLength(32)
  await check([password])
  await expect(page.getByRole('main')).not.toContainText(password)
  await page.reload()
  await expect(page.locator('[data-profile-password="true"]')).toBeVisible()
  await check([password])
})
