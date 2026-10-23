// T069: the second-factor step (US1-AS3, AS4, AS7–AS11, AS13, FR-020–FR-029 and its edge cases).
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectLanding, assertiveRegion, passwordForm, signInWithPassword } from '../fixtures/flows'

const YUBI_OTP = 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf'

function step(page: Page) {
  return {
    heading: page.getByRole('heading', { level: 1, name: 'Two-factor authentication' }),
    code: page.getByLabel('Six-digit code'),
    verify: page.getByRole('button', { name: 'Login', exact: true }),
    otherMethods: page.getByRole('button', { name: 'Other methods' }),
    yubiField: page.getByRole('textbox', { name: 'Authenticators', exact: true }),
    webauthn: page.getByRole('button', { name: 'Use your security key or passkey' }),
    cancel: page.getByRole('button', { name: 'Cancel' }),
  }
}

async function openStep(page: Page, username = 'alice@example.org') {
  await signInWithPassword(page, username)
  await expect(page).toHaveURL(/\/ng\/sign-in\/second-factor/)
  await expect(step(page).heading).toBeVisible()
}

test('US1-AS3 FR-020 the methods follow the server order, Yubico OTP sits under "Other methods", and TOTP lands on Password', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('mailbox-all-factors')
  await openStep(page)
  const s = step(page)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'WebAuthn authentication',
    'Time-based OTP (Google Authenticator, Authy, etc.)',
  ])
  await expect(s.yubiField).toHaveCount(0)
  await expect(s.otherMethods).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText(/Time left: [45]:\d\d/)).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()

  await s.otherMethods.click()
  await expect(s.yubiField).toBeVisible()
  await expectAccessible()

  await s.code.fill('123456')
  await s.verify.first().click()
  await expectLanding(page, 'mailboxUser')
})

test('US1-AS4 FR-022 with two authenticators the user chooses by name; with one it is preselected and the code has focus', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('totp-two-methods')
  await openStep(page)
  const group = page.getByRole('group', { name: 'Authenticators' })
  await expect(group.getByRole('radio')).toHaveCount(2)
  await expect(group.getByRole('radio', { name: 'Phone' })).toBeChecked()
  await group.getByRole('radio', { name: 'Tablet' }).check()
  await expectAccessible()
  await step(page).code.fill('654321')
  await step(page).verify.click()
  await expectLanding(page, 'mailboxUser')

  await mockApi.use('anonymous-default')
  await openStep(page)
  await expect(page.getByRole('group', { name: 'Authenticators' })).toHaveCount(0)
  await expect(step(page).code).toBeFocused()
})

test('US1-AS7 FR-024 a wrong code returns to the password step with the username kept', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('mailbox-all-factors')
  await openStep(page)
  await step(page).code.fill('000000')
  await step(page).verify.first().click()
  await expect(page).toHaveURL(/\/ng\/sign-in(\?|$)/)
  const notice = 'The code was not accepted. Please start the sign-in again.'
  await expect(page.getByRole('main').getByText(notice)).toBeVisible()
  await expect(passwordForm(page).username).toHaveValue('alice@example.org')
  await expect(passwordForm(page).password).toHaveValue('')
  await expectAccessible()
})

test('US1-AS8 FR-025 the step warns one minute before its limit and then times out with the username kept', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mailbox-all-factors')
  await page.clock.install()
  await openStep(page)
  await page.clock.fastForward('04:01')
  const warning = 'One minute left to complete the sign-in.'
  await expect(page.getByRole('main').getByText(warning)).toBeVisible()
  await expect(assertiveRegion(page)).toContainText(warning)
  await page.clock.fastForward('01:00')
  await expect(page).toHaveURL(/\/ng\/sign-in(\?|$)/)
  await expect(
    page.getByRole('main').getByText('The sign-in timed out. Please sign in again.'),
  ).toBeVisible()
  await expect(passwordForm(page).username).toHaveValue('alice@example.org')
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).toContain('cancelPendingSignIn')
})

test('US1-AS9 FR-026 Cancel ends the pending sign-in and shows the sign-in screen', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mailbox-all-factors')
  await openStep(page)
  await step(page).cancel.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).toContain('cancelPendingSignIn')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
})

test('US1-AS10 FR-027 a Yubico outage keeps the step open and allows a retry or another method', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('yubico-outage')
  await openStep(page)
  const s = step(page)
  await s.otherMethods.click()
  await s.yubiField.fill(YUBI_OTP)
  await page
    .getByRole('region', { name: 'Yubico OTP authentication' })
    .getByRole('button', { name: 'Login' })
    .click()
  // The classic interface's message (`danger.temp_error`).
  await expect(page.getByRole('alert')).toContainText('Temporary error')
  await expect(s.heading).toBeVisible()
  await expectAccessible()
  await s.code.fill('123456')
  await page
    .getByRole('region', { name: 'Time-based OTP (Google Authenticator, Authy, etc.)' })
    .getByRole('button', { name: 'Login' })
    .click()
  await expectLanding(page, 'mailboxUser')
})

test('US1-AS11 FR-028 an account with only U2F entries is told to ask an administrator', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('u2f-only')
  await signInWithPassword(page, 'alice@example.org')
  await expect(
    page
      .getByRole('main')
      .getByText('Your second factors cannot be used here. Ask an administrator to reset them.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await expectAccessible()
})

test('US1-AS13 FR-029 a reload resumes the step with the same methods and the remaining time', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mailbox-all-factors')
  await openStep(page)
  await page.reload()
  await expect(step(page).heading).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'WebAuthn authentication',
    'Time-based OTP (Google Authenticator, Authy, etc.)',
  ])
  await expect(page.getByText(/Time left: 4:\d\d/)).toBeVisible()
})

test('Edge: an account whose only second factor is Yubico OTP sees it directly', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('yubi-only')
  await openStep(page)
  await expect(step(page).otherMethods).toHaveCount(0)
  await expect(step(page).yubiField).toBeVisible()
  await expectAccessible()
  await step(page).yubiField.fill(YUBI_OTP)
  await step(page).verify.click()
  await expectLanding(page, 'mailboxUser')
})

test('Edge: a factor deactivated between the steps returns to the password step', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('totp-two-methods')
  await openStep(page)
  await mockApi.patch({
    accounts: {
      'alice@example.org': {
        secondFactors: [
          { id: 22, type: 'totp', name: 'Tablet', tier: 'primary', secret: '654321' },
        ],
      },
    },
  })
  await step(page).code.fill('123456')
  await step(page).verify.click()
  await expect(
    page.getByRole('main').getByText('The code was not accepted. Please start the sign-in again.'),
  ).toBeVisible()
  await expect(passwordForm(page).username).toHaveValue('alice@example.org')
})

test('FR-022 FR-023 the code formats are checked before submitting', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('mailbox-all-factors')
  await openStep(page)
  const s = step(page)
  await s.code.fill('12345')
  await s.verify.first().click()
  await expect(page.getByRole('main').getByText('Enter the six-digit code.')).toBeVisible()
  await expect(s.code).toHaveAttribute('aria-invalid', 'true')
  await expect(s.code).toHaveAttribute('inputmode', 'numeric')
  await expect(s.code).toHaveAttribute('autocomplete', 'one-time-code')
  await expectAccessible()

  await s.otherMethods.click()
  await s.yubiField.fill(YUBI_OTP.slice(1))
  await page
    .getByRole('region', { name: 'Yubico OTP authentication' })
    .getByRole('button', { name: 'Login' })
    .click()
  await expect(
    page.getByRole('main').getByText('Enter the 44 letters or digits your YubiKey types.'),
  ).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).not.toContain('verifySecondFactor')

  await s.code.fill('123 456')
  await page
    .getByRole('region', { name: 'Time-based OTP (Google Authenticator, Authy, etc.)' })
    .getByRole('button', { name: 'Login' })
    .click()
  await expectLanding(page, 'mailboxUser')
})

test('FR-021 @virtual-authenticator the WebAuthn second factor signs in', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('mailbox-all-factors')
  await webauthn.withoutConditionalMediation()
  const authenticator = await webauthn.virtualAuthenticator()
  await authenticator.addCredential()
  await openStep(page)
  await step(page).webauthn.click()
  await expectLanding(page, 'mailboxUser')
})

test('FR-021 a cancelled WebAuthn prompt keeps the step open without an error and allows another method', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('mailbox-all-factors')
  await webauthn.stubCredentialsRejection('NotAllowedError')
  await openStep(page)
  await step(page).webauthn.click()
  await expect(step(page).webauthn).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(step(page).heading).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).toContain('createSecondFactorWebAuthnChallenge')
  expect(ops).not.toContain('verifySecondFactor')
  await step(page).code.fill('123456')
  await step(page).verify.first().click()
  await expectLanding(page, 'mailboxUser')
})

test('six-digit boxes support typing, correction, paste and one-time-code autofill', async ({
  page,
  mockApi,
  context,
  browserName,
}) => {
  await mockApi.use('anonymous-default')
  await openStep(page)
  const code = step(page).code
  const slots = page.locator('[data-method="totp"] [data-code-digit]')
  await expect(slots).toHaveCount(6)
  await expect(code).toBeFocused()
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  await code.pressSequentially('123')
  await expect(slots).toHaveText(['1', '2', '3', '', '', ''])
  await code.press('Backspace')
  await code.pressSequentially('3456')
  await expect(code).toHaveValue('123456')
  await code.press('Home')
  await code.press('Delete')
  await expect(code).toHaveValue('23456')
  await code.press('1')
  await expect(code).toHaveValue('123456')

  const textbox = (await code.boundingBox())!
  const third = (await slots.nth(2).boundingBox())!
  await code.click({ position: { x: third.x + third.width / 2 - textbox.x, y: third.height / 2 } })
  await code.press('9')
  await expect(code).toHaveValue('129456')
  await code.press('ControlOrMeta+A')
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.evaluate(() => navigator.clipboard.writeText('012 345'))
    await code.press('ControlOrMeta+V')
  } else {
    // Bulk native input exercises the same path where clipboard permissions are unavailable.
    await page.keyboard.insertText('012 345')
  }
  await expect(code).toHaveValue('012345')
  await expect(slots).toHaveText(['0', '1', '2', '3', '4', '5'])
  await code.fill('123456')
  expect(await mockApi.countRequests('verifySecondFactor')).toBe(0)
  await page.screenshot({
    path: test.info().outputPath('six-digit-code.png'),
    animations: 'disabled',
  })
  await code.press('Enter')
  await expectLanding(page, 'mailboxUser')
})
