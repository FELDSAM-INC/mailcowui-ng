// UI 005 T063: reset factors, another device, and token-safe same-tab navigation.
import type { Page } from '@playwright/test'

import { securityKey, yubiOtp } from '../../mocks/scenarios/accounts'
import { RESET_TOKENS } from '../../mocks/scenarios/self-service/password-reset'
import { attachCspRecorder } from '../fixtures/csp'
import { expect, test } from '../fixtures/test'

const PASSWORD = 'summer2026x'
const YUBI_OTP = 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf'
const CREDENTIAL_ID = Buffer.from('password-reset security key').toString('base64url')

async function submitPassword(page: Page) {
  await page.getByLabel('New Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm new password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
}

test('US3-AS5 @virtual-authenticator the reset uses its own WebAuthn challenge and never signs in', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset', {
    accounts: { 'alice@example.org': { secondFactors: [securityKey(12, 'Security key')] } },
  })
  const authenticator = await webauthn.virtualAuthenticator()
  await authenticator.addCredential({ credentialId: CREDENTIAL_ID })
  await page.goto(`reset-password?token=${RESET_TOKENS.totp}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await submitPassword(page)
  await expect(page.locator('[data-reset-factor]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Use your security key or passkey' }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  const operations = (await mockApi.requests()).map((request) => request.operationId)
  expect(
    operations.filter((operation) => operation === 'createPasswordResetWebAuthnChallenge'),
  ).toHaveLength(1)
  expect(operations).not.toContain('createSecondFactorWebAuthnChallenge')
  expect(operations).not.toContain('verifySecondFactor')
  expect(operations).not.toContain('createSessionWithPasskey')
  expect(operations).not.toContain('createSession')
  await expect(page.locator('[data-reset-done]').getByRole('link', { name: 'Login' })).toBeVisible()
})

test('US3-AS5 a rejected WebAuthn reset proof names that method and retries with a fresh challenge', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset', {
    accounts: { 'alice@example.org': { secondFactors: [securityKey(12, 'Security key')] } },
  })
  await webauthn.stubCredentials(CREDENTIAL_ID)
  await page.goto(`reset-password#token=${RESET_TOKENS.totp}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expectAccessible()
  await submitPassword(page)
  await expect(page.locator('[data-reset-factor]')).toBeVisible()
  await expectAccessible()
  await mockApi.failNext('completePasswordReset', { status: 401, type: 'second-factor-failed' })
  const verify = page.getByRole('button', { name: 'Use your security key or passkey' })
  await verify.click()
  await expect(page.getByRole('alert')).toContainText('WebAuthn verification failed')
  await expect(verify).toBeEnabled()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await verify.click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expectAccessible()
  expect(await mockApi.countRequests('createPasswordResetWebAuthnChallenge')).toBe(2)
  expect(await webauthn.credentialCalls()).toEqual(['get:modal', 'get:modal'])
})

test('Edge US3-AS5 a wrong Yubico OTP and a service outage keep the reset step available for retry', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset', {
    accounts: { 'alice@example.org': { secondFactors: [yubiOtp(13, 'YubiKey')] } },
  })
  await page.goto(`reset-password?token=${RESET_TOKENS.totp}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expectAccessible()
  await submitPassword(page)
  await expect(page.locator('[data-reset-factor]')).toBeVisible()
  await expectAccessible()
  const code = page.getByRole('textbox', { name: 'Authenticators', exact: true })
  const verify = page.getByRole('button', { name: 'Login', exact: true })
  await code.fill('c'.repeat(44))
  await code.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Yubico OTP verification failed')
  await expect(code).toHaveValue('')
  await expectAccessible()
  await mockApi.failNext('completePasswordReset', {
    status: 503,
    type: 'temporary-verification-failure',
    retryAfter: 30,
  })
  await code.fill(YUBI_OTP)
  await code.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Temporary error')
  await expect(page.getByRole('alert')).toContainText('Yubico')
  await expect(code).toHaveValue('')
  await expect(verify).toBeEnabled()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await code.fill(YUBI_OTP)
  await code.press('Enter')
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expectAccessible()
  expect(
    (await mockApi.requests())
      .filter((request) => request.operationId === 'completePasswordReset')
      .map((request) => request.status),
  ).toEqual([401, 401, 503, 200])
})

test('Edge FR-037 a throttled TOTP completion cannot submit again until the countdown ends', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset')
  await page.clock.install()
  await page.goto(`reset-password?token=${RESET_TOKENS.totp}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expectAccessible()
  await submitPassword(page)
  await expect(page.locator('[data-reset-factor]')).toBeVisible()
  await expectAccessible()
  await mockApi.failNext('completePasswordReset', {
    status: 429,
    type: 'too-many-requests',
    retryAfter: 30,
  })
  const code = page.getByLabel('Six-digit code')
  const verify = page.getByRole('button', { name: 'Login', exact: true })
  await code.fill('123456')
  await verify.click()
  await expect(verify).toBeDisabled()
  await expect(page.getByRole('main')).toContainText('You can try again in')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await code.fill('123456')
  await code.press('Enter')
  expect(await mockApi.countRequests('completePasswordReset')).toBe(2)
  await page.clock.fastForward(31_000)
  await expect(verify).toBeEnabled()
  await verify.click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expectAccessible()
  expect(await mockApi.countRequests('completePasswordReset')).toBe(3)
})

test('Edge US3-AS4 a reset link works in a fresh browser context without the requesting device state', async ({
  browser,
  page,
  baseURL,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}, testInfo) => {
  const scenario = await mockApi.use('account-password-reset')
  await page.goto('reset-password/request')
  await page.getByLabel('Username').fill('carl@example.org')
  await page.getByRole('button', { name: 'Request password change' }).click()
  await expect(page.locator('[data-reset-requested]')).toBeVisible()
  await expectAccessible()
  const device = await browser.newContext({
    baseURL,
    locale: 'en-GB',
    viewport: page.viewportSize(),
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
    deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
  })
  const csp = await attachCspRecorder(device)
  try {
    expect(await device.cookies()).toEqual([])
    await device.addCookies([
      {
        name: 'mock-scenario',
        value: scenario,
        domain: new URL(baseURL!).hostname,
        path: '/',
      },
    ])
    const other = await device.newPage()
    await other.goto(`reset-password?token=${RESET_TOKENS.plain}`)
    await expect(other.locator('[data-reset-password]')).toBeVisible()
    await expect(other).toHaveURL(/\/ng\/reset-password$/)
    await expectAccessible(other)
    await expectNoHorizontalScroll(other)
    await submitPassword(other)
    await expect(other.locator('[data-reset-done]')).toBeVisible()
    await expectAccessible(other)
    await expectNoHorizontalScroll(other)
    await other.locator('[data-reset-done]').getByRole('link', { name: 'Login' }).click()
    await expect(other.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
    await expectAccessible(other)
    expect(csp.list()).toEqual([])
  } finally {
    await device.close()
  }
})

for (const separator of ['?', '#']) {
  test(`FR-038 the ${separator}token link never returns through back and forward history`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('account-password-reset')
    await page.goto('reset-password/request')
    await expect(page.getByLabel('Username')).toBeVisible()
    await expectAccessible()
    await page.goto(`reset-password${separator}token=${RESET_TOKENS.plain}`)
    await expect(page.locator('[data-reset-password]')).toBeVisible()
    await expect(page).toHaveURL(/\/ng\/reset-password$/)
    await expectAccessible()
    await page.goBack()
    await expect(page).toHaveURL(/\/ng\/reset-password\/request$/)
    await expect(page.getByLabel('Username')).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(/\/ng\/reset-password$/)
    // A browser may restore the live document from its back/forward cache. The token still
    // belongs only to component memory, and must never reappear in the URL or history state.
    await expect(page.locator('[data-reset-invalid], [data-reset-password]')).toBeVisible()
    expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(
      RESET_TOKENS.plain,
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
  })
}

test('Edge FR-038 a new reset fragment in the same tab replaces the account and removes the token', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto(`reset-password?token=${RESET_TOKENS.plain}`)
  await expect(page.locator('[data-reset-account]')).toContainText('carl@example.org')
  await expectAccessible()
  await page.evaluate((token) => {
    location.hash = `token=${token}`
  }, RESET_TOKENS.totp)
  await expect(page).toHaveURL(/\/ng\/reset-password$/)
  await expect(page.locator('[data-reset-account]')).toContainText('alice@example.org')
  await expectAccessible()
  await expectNoHorizontalScroll()
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(RESET_TOKENS.totp)
  await submitPassword(page)
  await expect(page.locator('[data-reset-factor]')).toBeVisible()
  await expectAccessible()
  await page.getByLabel('Six-digit code').fill('123456')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expectAccessible()
})
