// T145: what the app leaves in the browser (constitution V, FR-066, FR-091, data-model §4): only the
// listed storage keys, never a password, code, token, secret or username, nothing secret in the
// history state, and a working app when storage throws.
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'
import { MOCK_PASSWORD, submitPassword } from '../fixtures/flows'

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
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  await page
    .locator('[data-announcement]')
    .getByRole('button', { name: 'Hide announcement' })
    .click()
  await page.getByRole('button', { name: /^Account menu of/ }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await page.getByRole('button', { name: /^Account menu of/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
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
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1)

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
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  await page.getByRole('button', { name: 'Account menu of admin' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page
    .locator('[data-announcement]')
    .getByRole('button', { name: 'Hide announcement' })
    .click()
  await expect(
    page.locator('[data-announcement]').getByRole('button', { name: /Show announcement/ }),
  ).toBeVisible()
})
