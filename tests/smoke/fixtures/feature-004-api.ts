// Set-up and clean-up of UI 004 smoke tests through the real API (research R21). It acts as the
// signed-in user through the page's session cookie and a fresh anti-forgery token. Test code only;
// every object it creates has a unique name and is removed by the test that created it.
import { expect, type Page } from '@playwright/test'

import type { Alias, Domain } from '@/api'

export { signIn } from './domains-api'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}`

/** The first domain in the signed-in account's scope that is not a relay domain. */
export async function firstDomain(page: Page): Promise<Domain> {
  const response = await page.request.get('/api/v2/domains?limit=100&sort=name')
  expect(response.ok(), 'GET /domains').toBe(true)
  const domains = ((await response.json()) as { data: Domain[] }).data
  const domain = domains.find((item) => !item.backupMx && item.active)
  expect(domain, 'a seeded domain in scope').toBeTruthy()
  return domain!
}

/** The first mailbox of a domain, for destinations and sender permissions. */
export async function mailboxesOf(page: Page, domain: string): Promise<string[]> {
  const response = await page.request.get(`/api/v2/mailboxes?domain=${domain}&limit=10`)
  expect(response.ok(), 'GET /mailboxes').toBe(true)
  return ((await response.json()) as { data: { address: string }[] }).data.map((m) => m.address)
}

/**
 * The first domain in scope with at least `count` mailboxes, with those mailboxes. The seeded
 * example.net, first by name, has one.
 */
export async function domainWithMailboxes(
  page: Page,
  count: number,
): Promise<{ domain: Domain; mailboxes: string[] } | undefined> {
  const response = await page.request.get('/api/v2/domains?limit=100&sort=name')
  expect(response.ok(), 'GET /domains').toBe(true)
  const domains = ((await response.json()) as { data: Domain[] }).data
  for (const domain of domains.filter((item) => !item.backupMx && item.active)) {
    const mailboxes = await mailboxesOf(page, domain.name)
    if (mailboxes.length >= count) return { domain, mailboxes }
  }
  return undefined
}

export async function findAlias(page: Page, address: string): Promise<Alias | undefined> {
  const response = await page.request.get(`/api/v2/aliases?address=${encodeURIComponent(address)}`)
  if (!response.ok()) return undefined
  return ((await response.json()) as { data: Alias[] }).data[0]
}

/** Adds an alias that delivers to the given mailboxes, through the API. */
export async function createAlias(
  page: Page,
  address: string,
  destinations: string[],
): Promise<void> {
  const response = await page.request.post('/api/v2/aliases', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: { address, destinations },
  })
  expect(response.status(), `POST /aliases ${address}`).toBe(201)
}

export async function deleteAlias(page: Page, address: string): Promise<void> {
  const alias = await findAlias(page, address)
  if (!alias) return
  await page.request.delete(`/api/v2/aliases/${alias.id}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': alias.etag },
  })
}

export async function deleteAliasDomain(page: Page, name: string): Promise<void> {
  const read = await page.request.get(`/api/v2/alias-domains/${name}`)
  if (!read.ok()) return
  const { data } = (await read.json()) as { data: { etag: string } }
  await page.request.delete(`/api/v2/alias-domains/${name}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': data.etag },
  })
}

export async function deleteResource(page: Page, address: string): Promise<void> {
  const read = await page.request.get(`/api/v2/resources/${encodeURIComponent(address)}`)
  if (!read.ok()) return
  const { data } = (await read.json()) as { data: { etag: string } }
  await page.request.delete(`/api/v2/resources/${encodeURIComponent(address)}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': data.etag },
  })
}

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
