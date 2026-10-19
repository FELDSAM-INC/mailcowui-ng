// Set-up and clean-up of UI 010 smoke tests through the real API: reads of DKIM entries, MTA-STS
// policies and diagnostics, and deletions that keep the suite idempotent. It acts as the signed-in
// user with the page's session cookie and a fresh anti-forgery token. Test code only.
import { expect, type Page } from '@playwright/test'

import type { DkimKey, DnsDiagnosticsResult, MtaStsPolicy } from '@/api'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

export async function readDkimKey(page: Page, name: string): Promise<DkimKey | null> {
  const response = await page.request.get(`/api/v2/dkim-keys/${encodeURIComponent(name)}`)
  if (response.status() === 404) return null
  expect(response.ok(), `GET /dkim-keys/${name}`).toBe(true)
  return ((await response.json()) as { data: DkimKey }).data
}

/** Deletes a name's DKIM key if it has one. */
export async function deleteDkimKey(page: Page, name: string): Promise<void> {
  const entry = await readDkimKey(page, name)
  if (!entry?.etag) return
  const response = await page.request.delete(`/api/v2/dkim-keys/${encodeURIComponent(name)}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': entry.etag },
  })
  expect([204, 404], `delete DKIM key ${name}`).toContain(response.status())
}

export async function readPolicy(page: Page, domain: string): Promise<MtaStsPolicy | null> {
  const response = await page.request.get(`/api/v2/mta-sts-policies/${encodeURIComponent(domain)}`)
  if (response.status() === 404) return null
  expect(response.ok(), `GET /mta-sts-policies/${domain}`).toBe(true)
  return ((await response.json()) as { data: MtaStsPolicy }).data
}

export async function runDiagnostics(page: Page, name: string): Promise<DnsDiagnosticsResult> {
  const response = await page.request.get(`/api/v2/dns-diagnostics/${encodeURIComponent(name)}`, {
    timeout: 60_000,
  })
  expect(response.ok(), `GET /dns-diagnostics/${name}`).toBe(true)
  return ((await response.json()) as { data: DnsDiagnosticsResult }).data
}
