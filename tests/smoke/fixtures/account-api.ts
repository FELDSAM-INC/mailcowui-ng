// UI 005's destructive credential checks run only against the isolated dev stack. A separate
// administrator context restores the seeded account even if a browser assertion fails.
import { expect, type Page } from '@playwright/test'

import type { MailboxPatch, Writable } from '@/api'

import { freshTotp } from '../../support/totp'
import { alice } from './accounts'
import { expectHome, signIn } from './flows'

export function requireLocalStack(baseURL: string | undefined): void {
  expect(baseURL, 'A smoke base URL is required').toBeTruthy()
  expect(
    ['localhost', '127.0.0.1', '[::1]'],
    'Credential smoke tests need a local stack',
  ).toContain(new URL(baseURL!).hostname)
}

export async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.status()).toBe(200)
  return ((await response.json()) as { data: { token: string } }).data.token
}

export async function restoreMailbox(
  administrator: Page,
  address: string,
  patch: Writable<MailboxPatch>,
): Promise<void> {
  const uri = `/api/v2/mailboxes/${encodeURIComponent(address)}`
  const read = await administrator.request.get(uri)
  expect(read.status()).toBe(200)
  const { etag } = ((await read.json()) as { data: { etag: string } }).data
  const response = await administrator.request.patch(uri, {
    headers: {
      'X-CSRF-Token': await csrfToken(administrator),
      'If-Match': etag,
      'Content-Type': 'application/merge-patch+json',
    },
    data: patch,
  })
  expect(response.status(), 'Restore the local seeded mailbox').toBe(200)
}

export async function signInAlice(page: Page, password = alice.password): Promise<void> {
  // A requested app landing deliberately bypasses Alice's configured webmail forwarding.
  // The isolated stack has no SOGo; its hand-off is checked separately.
  await signIn(page, alice.username, password, 'sign-in?returnTo=%2F')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Two-factor authentication' }),
  ).toBeVisible()
  await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
  await page.getByRole('button', { name: 'Login', exact: true }).first().click()
  await expectHome(page, alice.username)
}

export async function changePassword(page: Page, current: string, next: string): Promise<void> {
  await page.goto('account/password')
  await page.getByLabel('New password', { exact: true }).fill(next)
  await page.getByLabel('Confirmation password (repeat)').fill(next)
  await page.getByLabel('Current password (confirm changes)').fill(current)
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.locator('[data-password-changed]')).toContainText(
    `Changes to mailbox ${alice.username} have been saved`,
  )
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveValue('')
}
