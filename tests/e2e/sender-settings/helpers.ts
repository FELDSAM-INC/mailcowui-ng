// Helpers of the "Allow to send as" end-to-end tests: the fields live in UI 003's "Mailbox" section.
import { expect, type Page } from '@playwright/test'

export const MAILBOX_PAGE = 'mailboxes/anna@example.org'

export async function openMailboxSection(page: Page): Promise<void> {
  await page.goto(`${MAILBOX_PAGE}?edit=mailbox`)
  await expect(page.locator('[data-sender-acl]')).toBeVisible()
}

export const entry = (page: Page, value: string) => page.locator(`[data-sender-entry="${value}"]`)

export const picker = (page: Page) =>
  page.getByRole('combobox', { name: 'Allow to send as', exact: true })

export const saveButton = (page: Page) =>
  page.locator('#section-mailbox').getByRole('button', { name: 'Save changes' })

/** The options of the "Allow to send as" list (not the native options of other fields). */
export const options = (page: Page) =>
  page.getByRole('listbox', { name: 'Allow to send as' }).getByRole('option')

export async function choose(page: Page, search: string, option: string | RegExp) {
  await picker(page).click()
  await picker(page).fill(search)
  await options(page).filter({ hasText: option }).first().click()
}
