// T050: the forced second-factor setup (US2-AS9, FR-057 to FR-059; legacy `#SetupTFAModal`,
// decision D10): the passkey first, then TOTP, WebAuthn and Yubico OTP, without the password.
import { totpCode } from '../../support/totp'
import { expect, test } from '../fixtures/test'

const screen = { level: 1, name: 'Actions required' } as const

test('US2-AS9 FR-058 the methods in order, and TOTP lifts the restriction', async ({
  page,
  browserName,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('forced-second-factor')
  await page.goto('domains')
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Two-Factor Authentication Required')
  // The passkey comes first wherever the browser can create one (WebKit here cannot).
  const buttons = page.locator('[data-forced-second-factor] button')
  if (browserName === 'chromium') await expect(buttons.first()).toHaveText('Register a passkey')
  await expect(page.locator('[data-forced-second-factor] [data-method]')).toHaveText([
    'Time-based OTP (Google Authenticator, Authy, etc.)',
    'WebAuthn authentication',
    'Yubico OTP authentication',
  ])
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.goto('account')
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await page.locator('[data-method="totp"]').click()
  const keyBox = page.locator('[data-grouped-secret]')
  await expect(keyBox).toBeVisible()
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveCount(0)
  const key = (await keyBox.innerText()).replace(/[\s,]/g, '')
  await page.getByLabel('An identifier for your key').fill('Phone')
  await page.getByLabel('Six-digit code').fill(totpCode(key, Date.now()))
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('heading', screen)).toHaveCount(0)
  await expect(page).toHaveURL(/\/ng\/account$/)
})

test('FR-057 without passkey support the other methods replace the classic link; Yubico lifts it', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('forced-second-factor')
  await webauthn.withoutPasskeySupport()
  await page.goto('')
  await expect(page.getByRole('button', { name: 'Register a passkey' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /classic interface/ })).toHaveCount(0)
  await page.locator('[data-method="yubiOtp"]').click()
  await page.getByLabel('An identifier for your Device').fill('YubiKey')
  await page.getByLabel('Yubico API ID').fill('12345')
  await page.getByLabel('Yubico API Key').fill('secret')
  await page.getByLabel('Touch Yubikey').fill('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
  await page.getByLabel('Touch Yubikey').press('Enter')
  await expect(page.getByRole('heading', screen)).toHaveCount(0)
})

test('@virtual-authenticator a security key lifts the restriction', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('forced-second-factor')
  await webauthn.virtualAuthenticator()
  await page.goto('')
  await page.locator('[data-method="webauthn"]').click()
  await page.getByLabel('An identifier for your Device').fill('Key')
  await page.getByRole('button', { name: 'Start validation' }).click()
  await expect(page.getByRole('heading', screen)).toHaveCount(0)
})

test('Edge: a reload resumes the setup screen', async ({ page, mockApi }) => {
  await mockApi.use('forced-second-factor')
  await page.goto('')
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-forced-second-factor]')).toBeVisible()
})
