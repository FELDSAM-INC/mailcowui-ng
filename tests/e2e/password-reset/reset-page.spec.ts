// T063: the reset page the e-mailed link opens (US3-AS4 to AS6, FR-038 to FR-042, SC-008 and the
// reset's edge cases; legacy `reset-password.twig`, decisions D8, D17).
import { expect, test } from '../fixtures/test'

const PLAIN = '3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7'
const TOTP = '7B21D0-55AE19-C0FFEE-12AB34-9E8D7C'

test('Edge FR-038 malformed reset links are cleared and show the invalid state', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-password-reset')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const suffix of ['#token=%E0%A4%A', '?token=one&token=two', '?token=']) {
    await page.goto('about:blank')
    await page.goto(`reset-password${suffix}`)
    await expect(page.locator('[data-reset-invalid]')).toBeVisible()
    await expect(page).toHaveURL(/\/ng\/reset-password$/)
  }
  expect(errors).toEqual([])
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'checkPasswordResetToken'),
  ).toHaveLength(0)
  await expectAccessible()
})

test('Edge FR-011 an unreachable token check shows an error and retries with the token in memory', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-password-reset')
  let offline = true
  await page.route('**/api/v2/password-resets/token-check', (route) =>
    offline ? route.abort('failed') : route.continue(),
  )
  await page.goto(`reset-password?token=${PLAIN}`)
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await expect(retry).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/reset-password$/)
  await expectAccessible()
  offline = false
  await retry.click()
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expect(retry).toHaveCount(0)
})

test('Edge FR-037 a throttled reset completion waits before allowing another attempt', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-password-reset', {
    failures: {
      completePasswordReset: { status: 429, type: 'too-many-requests', retryAfter: 30, times: 1 },
    },
  })
  await page.clock.install()
  await page.goto(`reset-password?token=${PLAIN}`)
  await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
  await page.getByLabel('Confirm new password').fill('summer2026x')
  const submit = page.getByRole('button', { name: 'Reset Password' })
  await submit.click()
  await expect(submit).toBeDisabled()
  await expect(page.getByRole('main')).toContainText('You can try again in')
  await expectAccessible()
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'completePasswordReset'),
  ).toHaveLength(1)
  await page.clock.fastForward(31_000)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
})

test('US3-AS4 FR-038 the token leaves the address at once and the rules are shown', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset')
  for (const link of [`reset-password?token=${PLAIN}`, `reset-password#token=${PLAIN}`]) {
    await mockApi.use('account-password-reset')
    // An e-mailed link opens a new document; a fragment change in the same document would not.
    await page.goto('about:blank')
    await page.goto(link)
    await expect(page.locator('[data-reset-password]')).toBeVisible()
    expect(page.url()).not.toContain(PLAIN)
    expect(page.url()).toMatch(/\/ng\/reset-password$/)
  }
  await expect(page.getByLabel('New Password', { exact: true })).toBeVisible()
  await expect(page.locator('[data-reset-account]')).toContainText('carl@example.org')
  await expect(page.locator('[data-reset-expiry]')).toContainText('minutes')
  await expect(page.locator('[data-reset-expiry] time')).toHaveAttribute('datetime', /T/)
  await expect(page.getByLabel('Confirm new password')).toBeVisible()
  await expect(page.locator('[data-password-policy] li')).toHaveCount(1)
  const historyState = await page.evaluate(() => JSON.stringify(window.history.state))
  expect(historyState).not.toContain(PLAIN)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
  await page.getByLabel('Confirm new password').fill('summer2026x')
  await page.getByRole('button', { name: 'Reset Password' }).click()
  await expect(page.locator('[data-reset-done]')).toContainText('Password was successfully changed')
  await expect(page.locator('[data-reset-done]')).toContainText(
    'All sessions of this account were signed out.',
  )
  await expectAccessible()
  await page.locator('[data-reset-done]').getByRole('link', { name: 'Login' }).click()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
})

test('FR-038 the displayed expiry ends the password and factor steps', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  for (const token of [PLAIN, TOTP]) {
    await mockApi.use('account-password-reset')
    await page.clock.install()
    await page.goto(`reset-password#token=${token}`)
    await expect(page.locator('[data-reset-password]')).toBeVisible()
    if (token === TOTP) {
      await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
      await page.getByLabel('Confirm new password').fill('summer2026x')
      await page.getByRole('button', { name: 'Reset Password' }).click()
      await expect(page.locator('[data-reset-factor]')).toBeVisible()
    }
    await page.clock.fastForward(16 * 60_000)
    await expect(page.locator('[data-reset-invalid]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator('[data-reset-expiry]')).toHaveCount(0)
    await expectAccessible()
    await page.clock.resume()
    await page.goto('about:blank')
  }
})

test('US3-AS5 an account with TOTP is asked for its code as at sign-in, with another try', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto(`reset-password?token=${TOTP}`)
  await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
  await page.getByLabel('Confirm new password').fill('summer2026x')
  await page.getByRole('button', { name: 'Reset Password' }).click()
  const step = page.locator('[data-reset-factor]')
  await expect(step).toContainText('Awaiting TFA confirmation')
  await expectAccessible()
  await page.getByLabel('Six-digit code').fill('000000')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(step).toContainText('TOTP verification failed')
  await page.getByLabel('Six-digit code').fill('123456')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toHaveCount(0)
})

test('US3-AS6 expired and used links show the invalid state with a new request', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-password-reset')
  for (const token of [
    '000000-EXPIRED-000000-000000-000000',
    '111111-USED00-111111-111111-111111',
  ]) {
    await page.goto(`reset-password?token=${token}`)
    await expect(page.locator('[data-reset-invalid]')).toContainText(
      'The reset password token is invalid or has expired.',
    )
  }
  await expectAccessible()
  await page.getByRole('link', { name: 'Request password change' }).click()
  await expect(page).toHaveURL(/\/ng\/reset-password\/request$/)
})

test('Edge: a reload after the token was read shows the invalid state', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto(`reset-password?token=${PLAIN}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-reset-invalid]')).toBeVisible()
})

test('Edge: an account with only deprecated factors is told to ask an administrator', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto('reset-password?token=222222-U2FONLY-222222-222222-22222')
  await expect(page.locator('[data-reset-ask-administrator]')).toBeVisible()
})

test('Edge FR-042 a signed-in browser is warned and its session ends without leaving the page', async ({
  page,
  mockApi,
  context,
}) => {
  await mockApi.use('account-password-reset-signed-in')
  const other = await context.newPage()
  await other.goto('account')
  await expect(other.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
  await page.goto('reset-password?token=333333-ANNA00-333333-333333-333333')
  await expect(page.locator('[data-reset-signed-in]')).toContainText('including this one')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
  await page.getByLabel('Confirm new password').fill('summer2026x')
  await page.getByRole('button', { name: 'Reset Password' }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/reset-password$/)
  await expect(other.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
})

test('SC-008 the token is never stored or logged', async ({ page, mockApi }) => {
  const messages: string[] = []
  page.on('console', (message) => messages.push(message.text()))
  await mockApi.use('account-password-reset')
  await page.goto(`reset-password?token=${PLAIN}`)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  const stored = await page.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }, history.state]),
  )
  expect(stored).not.toContain(PLAIN)
  expect(messages.join('\n')).not.toContain(PLAIN)
})
