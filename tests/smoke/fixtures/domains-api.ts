// Set-up and clean-up of UI 002 smoke tests through the real API (research D29). It uses the
// page's session cookie and a fresh anti-forgery token, so it acts as the signed-in user. Test code
// only: the app under test never uses it. Every object it creates has a unique name and is removed
// by the test that created it.
import { expect, type Page } from '@playwright/test'

import type {
  Domain,
  DomainCreateRequest,
  DomainTemplate,
  DomainTemplateCreateRequest,
} from '@/api'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

/** The seeded accounts of the API dev stack (research D29), overridable for a mailcow host. */
export const SMOKE_ACCOUNTS = {
  admin: {
    username: process.env.SMOKE_ADMIN_USERNAME ?? 'admin',
    password: process.env.SMOKE_ADMIN_PASSWORD ?? 'Passw0rd!dev',
    role: 'admin',
  },
  reseller: {
    username: process.env.SMOKE_DOMAIN_ADMIN_USERNAME ?? 'reseller',
    password: process.env.SMOKE_DOMAIN_ADMIN_PASSWORD ?? 'Passw0rd!dev',
    role: 'domainAdmin',
  },
} as const

/**
 * Signs the page's browser context in through the API (the sign-in screen is UI 001's subject),
 * so that the app opens with an active session.
 */
export async function signIn(page: Page, account: keyof typeof SMOKE_ACCOUNTS): Promise<void> {
  const { username, password, role } = SMOKE_ACCOUNTS[account]
  const response = await page.request.post('/api/v2/session', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: { username, password, role },
  })
  expect(response.status(), `sign in as ${username}`).toBe(201)
}

/** A unique, valid name: `<prefix>-<time><random>`, lower case. */
export function uniqueName(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${Date.now().toString(36)}${random}`.toLowerCase()
}

export async function createDomain(
  page: Page,
  name: string,
  body: Partial<Omit<DomainCreateRequest, 'name'>> = {},
): Promise<Domain> {
  const response = await page.request.post('/api/v2/domains', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: { name, ...body },
  })
  expect(response.status(), `create domain ${name}`).toBe(201)
  return ((await response.json()) as { data: Domain }).data
}

/** Deletes a domain if it still exists. */
export async function deleteDomain(page: Page, name: string): Promise<void> {
  const read = await page.request.get(`/api/v2/domains/${encodeURIComponent(name)}`)
  if (read.status() === 404) return
  const { etag } = ((await read.json()) as { data: Domain }).data
  const response = await page.request.delete(`/api/v2/domains/${encodeURIComponent(name)}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
  expect([204, 404], `delete domain ${name}`).toContain(response.status())
}

export async function createTemplate(
  page: Page,
  name: string,
  body: Partial<Omit<DomainTemplateCreateRequest, 'name'>> = {},
): Promise<DomainTemplate> {
  const response = await page.request.post('/api/v2/domain-templates', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: { name, ...body },
  })
  expect(response.status(), `create template ${name}`).toBe(201)
  return ((await response.json()) as { data: DomainTemplate }).data
}

/** Deletes a template if it still exists. */
export async function deleteTemplate(page: Page, id: number): Promise<void> {
  const read = await page.request.get(`/api/v2/domain-templates/${id}`)
  if (read.status() === 404) return
  const { etag } = ((await read.json()) as { data: DomainTemplate }).data
  const response = await page.request.delete(`/api/v2/domain-templates/${id}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
  expect([204, 404], `delete template ${id}`).toContain(response.status())
}
