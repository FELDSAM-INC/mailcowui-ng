// T049: adding second factors (US2-AS2 to AS5, FR-045 to FR-050, FR-113 and the enrolment's edge
// cases; legacy `#TOTPModal`, `#WebAuthnModal`, `#YubiOTPModal`).
import type { Page } from '@playwright/test'

import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { totpCode } from '../../support/totp'
import { expect, test } from '../fixtures/test'

async function shownKey(page: Page): Promise<string> {
  const key = page.locator('[data-grouped-secret]')
  await expect(key).toBeVisible()
  return (await key.innerText()).replace(/[\s,]/g, '')
}

for (const scenario of ['account-two-factor-empty', 'account-admin', 'account-domain-admin']) {
  test(`US2-AS2 FR-047 FR-113 an authenticator app is added with a code of the key shown (${scenario})`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('account/two-factor/add/totp')
    const key = await shownKey(page)
    expect(key).toMatch(/^[A-Z2-7]{32}$/)
    await expect(page.locator('[data-qr-code]')).toHaveAttribute(
      'aria-label',
      'QR code of the key shown as text',
    )
    const code = page.getByLabel('Six-digit code')
    await expect(code).toHaveAttribute('inputmode', 'numeric')
    await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByLabel('An identifier for your key').fill('Phone app')
    await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
    await code.fill(totpCode(key, Date.now()))
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Two-factor authentication' }),
    ).toBeVisible()
    await expect(page.locator('[data-second-factors]')).toContainText('Phone app')
    await expect(page.locator('[data-grouped-secret]')).toHaveCount(0)
  })
}

test('US2-AS3 a wrong code keeps the key with the attempts left; five wrong codes offer to start again', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  const key = await shownKey(page)
  await page.getByLabel('An identifier for your key').fill('Phone')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  const code = page.getByLabel('Six-digit code')
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await code.fill('000000')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(code).toHaveAttribute('aria-invalid', 'true')
  }
  await expect(page.getByRole('main')).toContainText('TOTP verification failed 1 attempt left.')
  await expect(page.getByRole('main')).toContainText('Check that the time on your phone')
  expect(await shownKey(page)).toBe(key)
  await code.fill('000000')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.locator('[data-totp-expired]')).toContainText('The setup expired. Start again.')
  await page.getByRole('button', { name: 'Start again' }).click()
  expect(await shownKey(page)).not.toBe(key)
})

test('Edge: an enrolment started elsewhere is reported as expired', async ({ page, mockApi }) => {
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  const key = await shownKey(page)
  await mockApi.patch({
    selfService: { accounts: { 'anna@example.org': { totpEnrolment: null } } },
  })
  await page.getByLabel('An identifier for your key').fill('Phone')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByLabel('Six-digit code').fill(totpCode(key, Date.now()))
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.locator('[data-totp-expired]')).toBeVisible()
})

test('US2-AS4 at 360 px “Open in authenticator app” and “Copy” come before the QR code', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  await shownKey(page)
  const order = await page.evaluate(() => {
    const all = [
      ...document.querySelectorAll('[data-open-in-app], [data-qr-code], [data-grouped-secret]'),
    ]
    return all.map((element) =>
      element.getAttribute('data-open-in-app') !== null
        ? 'open'
        : element.hasAttribute('data-qr-code')
          ? 'qr'
          : 'key',
    )
  })
  expect(order).toEqual(['key', 'open', 'qr'])
  await expect(page.getByRole('link', { name: 'Open in authenticator app' })).toHaveAttribute(
    'href',
    /^otpauth:\/\/totp\//,
  )
})

test('FR-045 the name and a wrong current password are checked', async ({ page, mockApi }) => {
  await mockApi.use('account-two-factor-empty')
  await page.goto('account/two-factor/add/totp')
  const key = await shownKey(page)
  await page.getByLabel('Six-digit code').fill(totpCode(key, Date.now()))
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByLabel('An identifier for your key')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('An identifier for your key').fill('Phone')
  await page.getByLabel('Current password (confirm changes)').fill('wrong')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('@virtual-authenticator a security key is added', async ({ page, mockApi, webauthn }) => {
  await mockApi.use('account-two-factor-empty')
  await webauthn.virtualAuthenticator()
  await page.goto('account/two-factor/add/webauthn')
  await page.getByLabel('An identifier for your Device').fill('YubiKey 5C')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Start validation' }).click()
  await expect(page.locator('[data-second-factors]')).toContainText('YubiKey 5C')
})

test('US2-AS5 without WebAuthn the security key is unavailable and the other methods work', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('account-two-factor-empty')
  await webauthn.withoutPasskeySupport()
  await page.goto('account/two-factor/add/webauthn')
  await expect(page.locator('[data-webauthn-unsupported]')).toHaveText('Browser not supported.')
  await expectAccessible()
  await page.goto('account/two-factor/add/totp')
  await shownKey(page)
})

test('FR-049 a cancelled ceremony and an enrolled key are explained with "Try again"', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('account-two-factor-empty')
  await webauthn.stubCredentialsRejection('NotAllowedError')
  await page.goto('account/two-factor/add/webauthn')
  await page.getByLabel('An identifier for your Device').fill('Key')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Start validation' }).click()
  await expect(page.locator('[data-webauthn-failure]')).toHaveText(
    'The request was cancelled or timed out.',
  )
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('FR-049 an already enrolled key is explained', async ({ page, mockApi, webauthn }) => {
  await mockApi.use('account-two-factor-empty')
  await webauthn.stubCredentialsRejection('InvalidStateError')
  await page.goto('account/two-factor/add/webauthn')
  await page.getByLabel('An identifier for your Device').fill('Key')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Start validation' }).click()
  await expect(page.locator('[data-webauthn-failure]')).toHaveText(
    'This security key is already enrolled as a second factor.',
  )
})

test('FR-050 Yubico OTP submits on the key’s final Enter; the same key replaces its entry', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-two-factor-empty')
  for (const name of ['YubiKey', 'YubiKey again']) {
    await page.goto('account/two-factor/add/yubi-otp')
    await expect(page.getByRole('main')).toContainText('uses the Yubico Cloud API')
    await expectAccessible()
    await page.getByLabel('An identifier for your Device').fill(name)
    await page.getByLabel('Yubico API ID').fill('12345')
    await page.getByLabel('Yubico API Key').fill('secret')
    await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
    const otp = page.getByLabel('Touch Yubikey')
    await otp.fill('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
    await otp.press('Enter')
    await expect(page.locator('[data-second-factors]')).toContainText(name)
  }
  await expect(page.locator('[data-second-factors] > li')).toHaveCount(1)
})

test('Edge: the Yubico outage names the service and offers "Try again"', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-yubico-outage-enrolment')
  await page.goto('account/two-factor/add/yubi-otp')
  await page.getByLabel('An identifier for your Device').fill('YubiKey')
  await page.getByLabel('Yubico API ID').fill('12345')
  await page.getByLabel('Yubico API Key').fill('secret')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByLabel('Touch Yubikey').fill('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('[data-yubico-failure]')).toHaveText(
    'Temporary error: Yubico verification service',
  )
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
