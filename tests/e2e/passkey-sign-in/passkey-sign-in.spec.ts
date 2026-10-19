// T086: passkey sign-in (US2-AS1–AS9, FR-010–FR-015 and the edge case of two pages).
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'
import { assertiveRegion, passwordForm } from '../fixtures/flows'
import type { MockApi } from '../fixtures/mock-api'

const passkeyButton = (page: Page) => page.getByRole('button', { name: 'Sign in with a passkey' })

const FAILED = 'Sign-in with this passkey failed. Sign in with your username and password instead.'

test('US2-AS1 FR-010 the passkey action comes first and most prominently, with the form below', async ({
  page,
  webauthn,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('sign-in')
  const button = passkeyButton(page)
  await expect(button).toBeVisible()
  await expect(passwordForm(page).username).toBeVisible()
  const order = await page.evaluate(() => {
    const passkey = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Sign in with a passkey',
    )
    const username = document.querySelector('input[name="username"]')
    return passkey && username
      ? passkey.compareDocumentPosition(username) & Node.DOCUMENT_POSITION_FOLLOWING
      : 0
  })
  expect(order, 'the passkey action precedes the form').toBeGreaterThan(0)
  await expect(button).toHaveAttribute('data-variant', 'primary')
  await expect(passwordForm(page).submit).toHaveAttribute('data-variant', 'secondary')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US2-AS2 FR-011 @virtual-authenticator a passkey signs in without username, password or second factor', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.withoutConditionalMediation()
  const authenticator = await webauthn.virtualAuthenticator()
  await authenticator.addCredential({ credentialId: SEEDED_CREDENTIALS.alice })
  await page.goto('sign-in')
  await passkeyButton(page).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).toContain('createSessionWithPasskey')
  expect(ops).not.toContain('createSession')
  expect(ops).not.toContain('verifySecondFactor')
})

test('US2-AS3 FR-010 without passkey support there is no passkey action and no error', async ({
  page,
  webauthn,
  expectAccessible,
}) => {
  await webauthn.withoutPasskeySupport()
  await page.goto('sign-in')
  await expect(passwordForm(page).username).toBeVisible()
  await expect(passkeyButton(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(passwordForm(page).username).toHaveAttribute('autocomplete', 'username')
  await expectAccessible()
})

test('US2-AS4 FR-013 a cancelled prompt returns without an error, and both options stay', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentialsRejection('NotAllowedError')
  await page.goto('sign-in')
  await expect.poll(() => webauthn.credentialCalls()).toEqual(['get:conditional'])
  await passkeyButton(page).click()
  await expect(passkeyButton(page)).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(passwordForm(page).submit).toBeEnabled()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).not.toContain('createSessionWithPasskey')
  // The autofill request was aborted for the prompt and resumes after it (UI 001 fix).
  await expect
    .poll(() => webauthn.credentialCalls())
    .toEqual(['get:conditional', 'get:modal', 'get:conditional'])
})

test('US2-AS5 FR-014 a passkey the server does not accept gives one generic message that suggests the password', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('sign-in')
  await passkeyButton(page).click()
  await expect(page.getByRole('alert')).toContainText(FAILED)
  await expect(assertiveRegion(page)).toContainText(FAILED)
  await expect(passwordForm(page).username).toBeVisible()
  await expectAccessible()
})

test('US2-AS6 too many passkey attempts disable the action until the retry time', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-throttled')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice)
  await page.clock.install()
  await page.goto('sign-in')
  await passkeyButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Too many attempts.')
  await expect(page.getByRole('main').getByText(/You can try again in 1:(30|29|28)/)).toBeVisible()
  await expect(passkeyButton(page)).toBeDisabled()
  await page.clock.fastForward('01:31')
  await expect(passkeyButton(page)).toBeEnabled()
})

test('US2-AS7 a passkey sign-in of an account forced to change its password gets a restricted session', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-forced-password-change')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.bob)
  await page.goto('sign-in')
  await passkeyButton(page).click()
  await expect
    .poll(async () => (await mockApi.requests()).map((r) => `${r.operationId} ${r.status}`))
    .toEqual(expect.arrayContaining(['createSessionWithPasskey 201', 'getIdentity 200']))
})

test('US2-AS8 @virtual-authenticator the domain-administrator screen refuses a mailbox user passkey generically', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.withoutConditionalMediation()
  const authenticator = await webauthn.virtualAuthenticator()
  await authenticator.addCredential({ credentialId: SEEDED_CREDENTIALS.alice })
  await page.goto('sign-in/domain-admin')
  await passkeyButton(page).click()
  await expect(page.getByRole('alert')).toContainText(FAILED)
  const [attempt] = (await mockApi.requests()).filter(
    (r) => r.operationId === 'createSessionWithPasskey',
  )
  expect(attempt?.body).toMatchObject({ role: 'domainAdmin' })
})

test('US2-AS9 FR-012 passkeys are offered in the username autofill, and no prompt opens by itself', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice)
  await page.goto('sign-in')
  await expect(passwordForm(page).username).toHaveAttribute('autocomplete', 'username webauthn')
  await expect.poll(() => webauthn.credentialCalls()).toEqual(['get:conditional'])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/ng\/sign-in$/)
})

test('US2-AS9 FR-012 choosing a passkey from the autofill signs in', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice, { conditional: 'release' })
  await page.goto('sign-in')
  await expect.poll(() => webauthn.credentialCalls()).toEqual(['get:conditional'])
  await webauthn.releaseConditional()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
})

const operations = async (mockApi: MockApi) => (await mockApi.requests()).map((r) => r.operationId)

/** What the iOS passkey sheet does to the page: it takes focus and visibility and gives them back. */
async function passkeySheet(page: Page) {
  await page.evaluate(() => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => state === 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    window.dispatchEvent(new Event('blur'))
    setVisibility('hidden')
    setVisibility('visible')
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
  })
}

/** A session refetch while signed out: another tab reports a changed session (research R12). */
async function sessionChangedElsewhere(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mailcowui-ng')
    channel.postMessage({ v: 1, type: 'session-changed' })
    channel.close()
  })
}

test('FR-012 the autofill request outlives focus changes and session refetches, and a passkey chosen afterwards signs in', async ({
  page,
  mockApi,
  webauthn,
}) => {
  // UI 001 fix (owner's iPhone): the passkey sheet takes focus and visibility from the page, and
  // the user's choice must still reach the request that was pending before.
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice, { conditional: 'release' })
  const count = async (operationId: string) =>
    (await operations(mockApi)).filter((op) => op === operationId).length

  // While the first challenge is on its way…
  await mockApi.delay('createPasskeyChallenge', 1_500)
  const challengeSent = page.waitForRequest((request) =>
    request.url().endsWith('/api/v2/session/passkey-challenge'),
  )
  await page.goto('sign-in')
  await challengeSent
  await passkeySheet(page)
  await expect.poll(() => webauthn.credentialCalls()).toEqual(['get:conditional'])
  await mockApi.delay('createPasskeyChallenge', 0)

  // …and while the request is pending.
  const sessionReads = await count('getSession')
  // Typed input that a remount of the sign-in screen would lose.
  await passwordForm(page).username.fill('someone')
  await passkeySheet(page)
  await sessionChangedElsewhere(page)
  await expect.poll(() => count('getSession')).toBeGreaterThan(sessionReads)
  await page.waitForLoadState('networkidle')

  expect(await count('createPasskeyChallenge'), 'no new challenge on focus or refetch').toBe(1)
  expect(await webauthn.credentialCalls()).toEqual(['get:conditional'])
  await expect(passwordForm(page).username).toHaveValue('someone')

  await webauthn.releaseConditional()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  expect(await count('createSessionWithPasskey')).toBe(1)
})

test('FR-012 an autofill request the browser ends without a passkey is restarted, and a passkey chosen then signs in', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice, { conditional: 'release' })
  await page.goto('sign-in')
  await expect.poll(() => webauthn.credentialCalls()).toEqual(['get:conditional'])
  // The user dismissed the browser's passkey prompt.
  await webauthn.rejectConditional('NotAllowedError')
  await expect
    .poll(() => webauthn.credentialCalls())
    .toEqual(['get:conditional', 'get:conditional'])
  await expect(page.getByRole('alert')).toHaveCount(0)
  await webauthn.releaseConditional()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  expect(
    (await operations(mockApi)).filter((op) => op === 'createSessionWithPasskey'),
  ).toHaveLength(1)
})

test('FR-007 UI 012 FR-041 force single sign-on keeps passkey sign-in on the role-neutral screen', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('sso-force')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('sign-in')
  await expect(passkeyButton(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Single Sign-On' })).toBeVisible()
  await expect(passwordForm(page).username).toHaveCount(0)
})

test('Edge: two pages take each other’s challenge, and the losing page restarts silently', async ({
  page,
  context,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice, { conditional: 'release' })
  await page.goto('sign-in')
  await expect.poll(() => webauthn.credentialCalls(page)).toEqual(['get:conditional'])
  const other = await context.newPage()
  await other.goto('sign-in')
  await expect.poll(() => webauthn.credentialCalls(other)).toEqual(['get:conditional'])

  const challenges = async () =>
    (await mockApi.requests()).filter((r) => r.operationId === 'createPasskeyChallenge').length
  const before = await challenges()
  await webauthn.releaseConditional(page)
  await expect
    .poll(async () => (await mockApi.requests()).map((r) => `${r.operationId} ${r.status}`))
    .toContain('createSessionWithPasskey 401')
  await expect.poll(challenges).toBe(before + 1)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page).toHaveURL(/\/ng\/sign-in$/)
  await expect(page.getByRole('main').getByText('Choose your passkey again.')).toBeVisible()
  await other.close()
})
