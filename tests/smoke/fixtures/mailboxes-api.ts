// Set-up and clean-up of UI 003 smoke tests through the real API (research D29), with the page's
// session cookie and a fresh anti-forgery token, as `domains-api.ts` does for UI 002. Test code
// only: the app under test never uses it. Every mailbox it creates has a unique local part and is
// removed by the test that created it.
import { expect, type Page } from '@playwright/test'

import type { Mailbox, MailboxCreateRequest } from '@/api'

import { uniqueName } from './domains-api'

/** The seeded domain the smoke tests add their mailboxes to (quickstart Part C). */
export const SMOKE_DOMAIN = 'example.org'

const MIB = 1024 ** 2

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

/** A local part that no seeded mailbox has: `smoke.<time><random>`. */
export function uniqueLocalPart(): string {
  return uniqueName('smoke').replace(/-/g, '.')
}

/**
 * Adds a mailbox to `SMOKE_DOMAIN` with a password that meets the dev stack's policy and a small
 * quota, so that the domain's 5 GiB leave room for the test's own changes.
 */
export async function createMailbox(
  page: Page,
  localPart: string,
  body: Partial<Omit<MailboxCreateRequest, 'localPart' | 'domain'>> = {},
): Promise<Mailbox> {
  const response = await page.request.post('/api/v2/mailboxes', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: {
      localPart,
      domain: SMOKE_DOMAIN,
      password: `Smoke-${Math.random().toString(36).slice(2, 10)}-7q`,
      quota: 100 * MIB,
      ...body,
    },
  })
  expect(response.status(), `create mailbox ${localPart}@${SMOKE_DOMAIN}`).toBe(201)
  return ((await response.json()) as { data: Mailbox }).data
}

/** The mailbox as the API returns it now. */
export async function readMailbox(page: Page, address: string): Promise<Mailbox> {
  const response = await page.request.get(`/api/v2/mailboxes/${address}`)
  expect(response.status(), `read mailbox ${address}`).toBe(200)
  return ((await response.json()) as { data: Mailbox }).data
}

/** Removes a mailbox if it still exists, for example after a failed run. */
export async function deleteMailbox(page: Page, address: string): Promise<void> {
  const read = await page.request.get(`/api/v2/mailboxes/${address}`)
  if (read.status() === 404) return
  const { etag } = ((await read.json()) as { data: { etag: string } }).data
  const response = await page.request.delete(`/api/v2/mailboxes/${address}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
  expect([204, 404], `delete mailbox ${address}`).toContain(response.status())
}
