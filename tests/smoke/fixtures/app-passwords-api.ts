// Metadata reads and cleanup for UI 005 app-password smoke tests. Every cleanup uses the latest
// version, and only the test's uniquely named entry is removed.
import { expect, type Page } from '@playwright/test'

import type { AppPassword } from '@/api'

import { csrfToken } from './account-api'

export function appPasswordPath(mailbox: string): string {
  return `/api/v2/mailboxes/${encodeURIComponent(mailbox)}/app-passwords`
}

export async function listAppPasswords(page: Page, mailbox: string): Promise<AppPassword[]> {
  const response = await page.request.get(appPasswordPath(mailbox))
  expect(response.status(), 'Read app-password metadata').toBe(200)
  const { data } = (await response.json()) as { data: AppPassword[] }
  for (const entry of data) {
    expect(Object.keys(entry).sort(), 'Only the documented metadata is readable').toEqual([
      'active',
      'createdAt',
      'etag',
      'id',
      'mailbox',
      'modifiedAt',
      'name',
      'protocols',
    ])
  }
  return data
}

export async function removeSmokeAppPasswords(
  page: Page,
  mailbox: string,
  name: string,
): Promise<void> {
  const entries = await listAppPasswords(page, mailbox)
  for (const entry of entries.filter((item) => item.name === name)) {
    const response = await page.request.delete(`${appPasswordPath(mailbox)}/${entry.id}`, {
      headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': entry.etag },
    })
    expect(response.status(), 'Remove the smoke app password').toBe(204)
  }
}
