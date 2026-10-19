// T144: the main path of every user story with the keyboard alone, with focus visible at every
// step (FR-080, SC-004). Fields are reached with Tab; no pointer event is sent.
import type { Locator, Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'
import { isNarrow, MOCK_PASSWORD } from '../fixtures/flows'

/** Presses Tab until the target has focus, checking that focus is visible at every step. */
async function tabTo(page: Page, target: Locator, limit = 60): Promise<void> {
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press('Tab')
    const visible = await page.evaluate(() => {
      const focused = document.activeElement
      return !focused || focused === document.body || focused.matches(':focus-visible')
    })
    expect(visible, 'focus is visible').toBe(true)
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('the target was not reached with Tab')
}

async function arrowTo(page: Page, name: string, limit = 20): Promise<void> {
  for (let step = 0; step < limit; step++) {
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    if (text === name) return
    await page.keyboard.press('ArrowDown')
  }
  throw new Error(`"${name}" was not reached with the arrow keys`)
}

test('US1 password sign-in with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('admin-password')
  await page.goto('sign-in')
  await tabTo(page, page.getByLabel('Username', { exact: true }))
  await page.keyboard.type('admin')
  await page.keyboard.press('Tab')
  await page.keyboard.type(MOCK_PASSWORD)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
})

test('US1 the second factor with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('anonymous-default')
  await page.goto('sign-in')
  await tabTo(page, page.getByLabel('Username', { exact: true }))
  await page.keyboard.type('alice@example.org')
  await page.keyboard.press('Tab')
  await page.keyboard.type(MOCK_PASSWORD)
  await page.keyboard.press('Enter')
  const code = page.getByLabel('Six-digit code')
  await expect(code).toBeFocused()
  await page.keyboard.type('123456')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
})

test('US2 passkey sign-in with the keyboard', async ({ page, mockApi, webauthn }) => {
  await mockApi.use('passkey-user')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.alice)
  await page.goto('sign-in')
  await tabTo(page, page.getByRole('button', { name: 'Sign in with a passkey' }))
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
})

test('US3 navigation with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  if (isNarrow(page)) {
    await tabTo(page, page.getByRole('button', { name: 'Toggle navigation' }))
    await page.keyboard.press('Enter')
    await tabTo(page, page.getByRole('dialog').getByRole('link', { name: 'Mailboxes' }))
  } else {
    await tabTo(
      page,
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Mailboxes' }),
    )
  }
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeFocused()
})

test('US4 adding a passkey with the keyboard', async ({ page, mockApi, webauthn }) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentials('a2V5Ym9hcmQtcGFzc2tleQ')
  await page.goto('passkeys')
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
  await tabTo(page, page.getByLabel('Name (optional)'))
  await page.keyboard.type('Keyboard')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: 'Keyboard' }),
  ).toBeVisible()
})

test('US5 "Check again" with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await tabTo(page, page.getByRole('button', { name: 'Check again' }))
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('main').getByText('The password change is still pending.'),
  ).toBeVisible()
})

test('US6 choosing a language with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  await tabTo(page, page.getByRole('button', { name: 'Account menu of admin' }))
  await page.keyboard.press('Enter')
  await arrowTo(page, 'Čeština (Czech)')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Dobrý den, admin' })).toBeVisible()
})

test('US7 creating an API key and copying its secret with the keyboard', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('api-keys-empty')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await page.goto('api-keys/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Create API key' })).toBeVisible()
  await tabTo(page, page.getByRole('textbox', { name: 'Name' }))
  await page.keyboard.type('Keyboard key')
  await tabTo(page, page.getByRole('button', { name: 'Create API key' }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Your new API key' })
  await expect(dialog).toBeVisible()
  await tabTo(page, dialog.getByRole('button', { name: 'Copy' }), 10)
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('status')).toContainText('Copied to the clipboard.')
  await tabTo(page, dialog.getByRole('button', { name: 'Close' }).last(), 10)
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
})

test('US8 filtering the audit log with the keyboard', async ({ page, mockApi }) => {
  await mockApi.use('audit-records')
  await page.goto('audit-log')
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await tabTo(page, toggle)
    await page.keyboard.press('Enter')
  }
  const form = page.getByRole('form', { name: 'Filters' })
  await tabTo(page, form.getByRole('checkbox', { name: 'Sign-in' }))
  await page.keyboard.press('Space')
  // Every labelled event and target type is a checkbox on the way (UI 009 adds 21 and 8).
  await tabTo(page, form.getByRole('button', { name: 'Apply filters' }), 150)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Active filters' })).toContainText('Sign-in')
})
