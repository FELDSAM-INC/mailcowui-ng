// T145: what the app leaves in the browser (constitution V, FR-066, FR-091, data-model §4): only the
// listed storage keys, never a password, code, token, secret or username, nothing secret in the
// history state, and a working app when storage throws.
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'
import { MOCK_PASSWORD, submitPassword, chooseTheme } from '../fixtures/flows'

const LOCAL_KEYS = [
  'mailcowui-ng.locale',
  'mailcowui-ng.theme',
  'mailcowui-ng.passkey-suggestion-dismissed',
]
// UI 012: the requested in-app path during a single sign-on round trip only.
const SESSION_KEYS = ['mailcowui-ng.announcement-collapsed', 'mailcowui-ng.sso-return-to']

async function expectCleanStorage(page: Page, forbidden: string[]) {
  const snapshot = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
    history: JSON.stringify(history.state ?? null),
  }))
  for (const key of Object.keys(snapshot.local)) expect(LOCAL_KEYS).toContain(key)
  for (const key of Object.keys(snapshot.session)) expect(SESSION_KEYS).toContain(key)
  const everything = JSON.stringify([snapshot.local, snapshot.session, snapshot.history])
  for (const value of forbidden) expect(everything).not.toContain(value)
}

test('FR-091 password and second-factor sign-in, passkey sign-in and preferences leave only the listed keys', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice)
  await page.goto('sign-in')
  await submitPassword(page, 'alice@example.org')
  await page.getByLabel('Six-digit code').fill('123456')
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await page
    .locator('[data-announcement]')
    .getByRole('button', { name: 'Hide announcement' })
    .click()
  await chooseTheme(page, 'Dark')
  await page.getByRole('button', { name: /^Account menu of/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  const token = (await mockApi.requests()).find((r) => r.headers['x-csrf-token'])?.headers[
    'x-csrf-token'
  ]
  await expectCleanStorage(page, [
    MOCK_PASSWORD,
    '123456',
    'alice',
    SEEDED_CREDENTIALS.alice,
    token ?? '§',
  ])
})

test('FR-066 FR-091 a passkey registration and an API key secret leave nothing in storage or history', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('api-keys-empty')
  await webauthn.stubCredentials('c3RvcmFnZS1jaGVjay1jcmVk')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await page.goto('passkeys')
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  const passkeys = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2 }) })
  await expect(passkeys).toHaveCount(1)

  await page.goto('api-keys/new')
  await page.getByRole('textbox', { name: 'Name' }).fill('Storage check')
  await page.getByRole('button', { name: 'Create API key' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your new API key' })
  const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
  expect(secret).toMatch(/^mcv2_/)
  await expectCleanStorage(page, [secret, 'admin'])
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toHaveCount(0)
  await page.goBack()
  await expect(page.getByText(secret)).toHaveCount(0)
  await expectCleanStorage(page, [secret, 'admin'])
})

test('UI 012 SC-003 FR-081 the identity provider secrets never reach storage, history or request headers', async ({
  page,
  mockApi,
}) => {
  const bindPassword = 'bind-secret-SC003'
  const newPassword = 'bind-secret-renewed'
  await mockApi.use('idp-none')
  await page.goto('identity-providers/provider')
  await page.locator('#idp-type').selectOption({ label: 'LDAP' })
  await page.locator('#idp-hosts').fill('ldap1.example.org')
  await page.locator('#idp-baseDn').fill('dc=example,dc=org')
  await page.locator('#idp-bindDn').fill('cn=admin,dc=example,dc=org')
  await page.locator('#idp-bindPassword').fill(bindPassword)
  await page.getByRole('button', { name: 'Test Connection' }).click()
  await expect(page.locator('[data-test-result]')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-page-status]')).toBeVisible()
  await page.getByRole('button', { name: 'Edit LDAP' }).click()
  await page.locator('#idp-hosts').fill('ldap2.example.org')
  await page.locator('#idp-bindPassword').fill(newPassword)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#section-provider').getByRole('status')).toBeVisible()
  await expectCleanStorage(page, [bindPassword, newPassword])
  expect(await page.locator('body').innerText()).not.toContain(bindPassword)
  const requests = await mockApi.requests()
  for (const request of requests) {
    expect(JSON.stringify(request.headers)).not.toContain(bindPassword)
    expect(request.path).not.toContain(bindPassword)
  }
  const withSecret = requests.filter((request) =>
    JSON.stringify(request.body ?? '').includes(bindPassword),
  )
  expect(withSecret.map((request) => request.operationId).sort()).toEqual([
    'saveIdentityProvider',
    'testIdentityProviderConnection',
  ])
})

test('UI 012 SC-003 a single sign-on round trip leaves neither the code, the state nor the kept address', async ({
  page,
  mockApi,
  fakeProvider,
}) => {
  test.slow()
  await mockApi.use('sso-available')
  const provider = await fakeProvider()
  await page.goto('passkeys')
  await page.getByRole('button', { name: 'Single Sign-On' }).click()
  await expect(page).toHaveURL(/\/ng\/passkeys$/, { timeout: 15_000 })
  const [state] = provider.states()
  const [code] = provider.codes()
  await expectCleanStorage(page, [state!, code!])
  const kept = await page.evaluate(() => sessionStorage.getItem('mailcowui-ng.sso-return-to'))
  expect(kept).toBeNull()
})

test('UI 012 SC-003 an OAuth2 client secret appears only in its dialog', async ({
  page,
  mockApi,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await mockApi.use('oauth2-empty')
  await page.goto('identity-providers/oauth2-apps/new')
  await page
    .getByRole('textbox', { name: /Redirect URI/ })
    .fill('https://wiki.example.org/oauth/callback')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add OAuth2 client' })
  const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
  expect(secret).toMatch(/^[0-9a-f]{24}$/)
  await expectCleanStorage(page, [secret])
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(secret)).toHaveCount(0)
  await expectCleanStorage(page, [secret])
  for (const request of await mockApi.requests()) {
    expect(JSON.stringify(request.headers)).not.toContain(secret)
  }
})

test('Edge: with storage disabled the app still signs in and works', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException('Storage is disabled', 'SecurityError')
        },
      })
    }
  })
  await mockApi.use('admin-password')
  await page.goto('sign-in')
  await submitPassword(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await chooseTheme(page, 'Dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page
    .locator('[data-announcement]')
    .getByRole('button', { name: 'Hide announcement' })
    .click()
  await expect(
    page.locator('[data-announcement]').getByRole('button', { name: /Show announcement/ }),
  ).toBeVisible()
})

// UI 004 T110: the alias forms, the "Edit alias" section and the sender fields keep their input in
// memory only (research R10): nothing reaches storage or the history state, and a session expiry
// gives the section's input back after a new sign-in in the same tab.
test('UI 004 US2 US3 US5 forms leave no value in storage or history, and a section draft survives a session expiry', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('aliases-edit')
  await page.goto('aliases/new')
  await page.getByLabel('Alias address/es').fill('stored-nowhere@example.org')
  await page.getByLabel('Goto addresses').fill('bob@example.org')
  await expectCleanStorage(page, ['stored-nowhere@example.org'])

  await page.goto('aliases/1?edit=alias')
  const comment = page.locator('#section-alias').getByRole('textbox', { name: 'Public comment' })
  await comment.fill('draft-comment-123')
  await expectCleanStorage(page, ['draft-comment-123'])
  await mockApi.patch({ expireSession: true })
  await page.locator('#section-alias').getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
  await submitPassword(page, 'admin')
  await expect(page).toHaveURL(/\/ng\/aliases\/1\?edit=alias$/)
  await expect(comment).toHaveValue('draft-comment-123')
  await expectCleanStorage(page, ['draft-comment-123'])

  await mockApi.use('sender-settings')
  await page.goto('mailboxes/anna@example.org?edit=mailbox')
  await page.getByLabel('External sender addresses').fill('secret-sender@mailer.example')
  await expectCleanStorage(page, ['secret-sender@mailer.example'])
})
