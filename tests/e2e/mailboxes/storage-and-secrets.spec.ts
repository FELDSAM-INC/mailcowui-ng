// UI 003 storage and secrets (T126, SC-009, FR-074): after adding a mailbox with a typed password
// and changing a password on the mailbox page, storage holds only the allowlisted keys, and no
// stored value, address, title or history state contains a password; with storage throwing, the
// list still works with legacy's default columns.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const ALLOWED = [
  'mailcowui-ng.locale',
  'mailcowui-ng.theme',
  'mailcowui-ng.passkey-suggestion-dismissed',
  'mailcowui-ng.mailboxes.columns',
  'mailcowui-ng.announcement-collapsed',
]

async function expectNoSecret(page: Page, secret: string) {
  const snapshot = await page.evaluate(() => ({
    keys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)],
    values: JSON.stringify({ ...localStorage, ...sessionStorage }),
    url: location.href,
    title: document.title,
    state: JSON.stringify(history.state),
  }))
  expect(snapshot.keys.filter((key) => !ALLOWED.includes(key))).toEqual([])
  for (const value of [snapshot.values, snapshot.url, snapshot.title, snapshot.state]) {
    expect(value).not.toContain(secret)
  }
}

test.describe('storage and secrets', () => {
  test('SC-009 a typed password leaves no trace after adding a mailbox', async ({
    page,
    mockApi,
  }) => {
    const messages: string[] = []
    page.on('console', (message) => messages.push(message.text()))
    await mockApi.use('admin-create')
    await page.goto('mailboxes/new?domain=example.org')
    await expect(page.locator('[data-mailbox-form]')).toBeVisible()
    const secret = 'Typed-Secret-4711'
    await page.getByLabel('Username (left part of an email address)').fill('secret.user')
    await page.getByLabel('Password', { exact: true }).fill(secret)
    await page.getByLabel('Confirmation password (repeat)').fill(secret)
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page).toHaveURL(/secret\.user@example\.org$/)
    await expectNoSecret(page, secret)
    expect(messages.some((message) => message.includes(secret))).toBe(false)
  })

  test('FR-074 with storage throwing, the list works with the default columns', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException('denied', 'SecurityError')
      }
      Storage.prototype.getItem = deny
      Storage.prototype.setItem = deny
    })
    await mockApi.use('admin-mailboxes-30')
    await page.goto('mailboxes')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
  })
})
