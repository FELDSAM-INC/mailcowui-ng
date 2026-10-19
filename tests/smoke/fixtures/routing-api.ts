// Set-up and clean-up of UI 009 smoke tests through the real API (research R25), as the signed-in
// user of the page's context. Test code only: the app under test never uses it. Every entry a test
// creates has a unique value and is removed by the test that created it, also when it fails.
import { expect, type Page } from '@playwright/test'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

type Collection =
  | 'relayhosts'
  | 'transports'
  | 'bcc-maps'
  | 'recipient-maps'
  | 'tls-policy-maps'
  | 'forwarding-hosts'

interface Entry {
  id?: number
  address?: string
  etag: string
  [key: string]: unknown
}

/** The entries of a collection whose `member` equals `value` (first page of a search). */
export async function findEntries(
  page: Page,
  collection: Collection,
  member: string,
  value: string,
): Promise<Entry[]> {
  const response = await page.request.get(
    `/api/v2/${collection}?q=${encodeURIComponent(value)}&limit=100`,
  )
  expect(response.ok(), `list ${collection}`).toBe(true)
  const { data } = (await response.json()) as { data: Entry[] }
  return data.filter((item) => item[member] === value)
}

/** Deletes every entry of a collection whose `member` equals `value`. */
export async function deleteEntries(
  page: Page,
  collection: Collection,
  member: string,
  value: string,
): Promise<void> {
  for (const item of await findEntries(page, collection, member, value)) {
    const key = collection === 'forwarding-hosts' ? item.address! : String(item.id)
    const response = await page.request.delete(`/api/v2/${collection}/${encodeURIComponent(key)}`, {
      headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': item.etag },
    })
    expect([204, 404], `delete ${collection} ${key}`).toContain(response.status())
  }
}

/** A random password that the test can search for in the page and the API's log. */
export function smokePassword(): string {
  return `Smoke-${Math.random().toString(36).slice(2, 10)}-Secret`
}
