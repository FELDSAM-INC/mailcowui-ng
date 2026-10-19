// Set-up and clean-up of the UI 012 identity provider smoke tests through the real API (research
// R25): the mailbox template "Staff" for the mapping, the identity provider configuration, removed
// before and after a test when no mailbox uses it, and the mailboxes that directory sign-ins create. It uses the page's session cookie and a
// fresh anti-forgery token, so it acts as the signed-in administrator. Test code only.
import { expect, type Page } from '@playwright/test'

/** The API dev stack's OpenLDAP of the `idp` profile (mailcow-rest-v2 compose.yaml). */
export const DEV_LDAP = {
  host: 'openldap',
  baseDn: 'dc=example,dc=org',
  bindDn: 'cn=admin,dc=example,dc=org',
  bindPassword: 'ldap-secret',
}

/**
 * The API dev stack's Keycloak of the `idp` profile, with mailcow-rest-v2's realm import
 * (`docker/keycloak/example-realm.json`): realm `example`, client `mailcow`, and the user
 * anna@example.org with the `mailcow_template` claim `staff`. The API reaches it by its service
 * name; the browser through the smoke project's host mapping (`playwright.config.ts`).
 */
export const DEV_KEYCLOAK = {
  serverUrl: 'http://keycloak:8080',
  realm: 'example',
  clientId: 'mailcow',
  clientSecret: 'kc-secret',
  version: '26.0.7',
  username: 'anna@example.org',
  password: 'Passw0rd!dev',
}

export const idpEnabled = () => process.env.SMOKE_IDP === '1'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  expect(response.ok(), 'GET /csrf-token').toBe(true)
  return ((await response.json()) as { data: { token: string } }).data.token
}

/** Creates the mailbox template if no template of that name exists. */
export async function ensureMailboxTemplate(page: Page, name: string): Promise<void> {
  const list = await page.request.get(
    `/api/v2/mailbox-templates?q=${encodeURIComponent(name)}&limit=100`,
  )
  expect(list.ok(), 'GET /mailbox-templates').toBe(true)
  const { data } = (await list.json()) as { data: { name: string }[] }
  if (data.some((template) => template.name === name)) return
  const created = await page.request.post('/api/v2/mailbox-templates', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
    data: { name },
  })
  expect(created.status(), `create the mailbox template ${name}`).toBe(201)
}

/** Removes the identity provider configuration, unless none is stored or mailboxes use it. */
export async function removeIdentityProvider(page: Page): Promise<void> {
  const read = await page.request.get('/api/v2/identity-provider')
  if (read.status() === 404) return
  expect(read.ok(), 'GET /identity-provider').toBe(true)
  const etag = read.headers()['etag'] ?? ''
  const removal = await page.request.delete('/api/v2/identity-provider', {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
  expect([204, 404, 409], 'DELETE /identity-provider').toContain(removal.status())
}

/** Removes a mailbox if it exists, for example one that a directory sign-in created. */
export async function removeMailbox(page: Page, address: string): Promise<void> {
  const read = await page.request.get(`/api/v2/mailboxes/${encodeURIComponent(address)}`)
  if (read.status() === 404) return
  expect(read.ok(), `GET /mailboxes/${address}`).toBe(true)
  const { etag } = ((await read.json()) as { data: { etag: string } }).data
  const removal = await page.request.delete(`/api/v2/mailboxes/${encodeURIComponent(address)}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
  expect([204, 404], `DELETE /mailboxes/${address}`).toContain(removal.status())
}

/**
 * Stores the dev stack's LDAP directory as the identity provider (US3's precondition), with the
 * mapping of API quickstart Part B: `title: staff` selects the mailbox template "Staff", from which
 * a directory user without a mailbox gets one at the first sign-in.
 */
export async function configureDevLdap(page: Page): Promise<void> {
  await ensureMailboxTemplate(page, 'Staff')
  await removeIdentityProvider(page)
  const saved = await page.request.put('/api/v2/identity-provider', {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-None-Match': '*' },
    data: {
      type: 'ldap',
      hosts: [DEV_LDAP.host],
      baseDn: DEV_LDAP.baseDn,
      bindDn: DEV_LDAP.bindDn,
      bindPassword: DEV_LDAP.bindPassword,
      usernameField: 'mail',
      attributeField: 'title',
      attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
    },
  })
  expect([200, 201], 'PUT /identity-provider').toContain(saved.status())
}

/** Stores the dev stack's Keycloak as the identity provider (US2's precondition on the dev stack). */
export async function configureDevKeycloak(page: Page): Promise<void> {
  await ensureMailboxTemplate(page, 'Staff')
  await removeIdentityProvider(page)
  const saved = await page.request.put('/api/v2/identity-provider', {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-None-Match': '*' },
    data: {
      type: 'keycloak',
      serverUrl: DEV_KEYCLOAK.serverUrl,
      realm: DEV_KEYCLOAK.realm,
      clientId: DEV_KEYCLOAK.clientId,
      clientSecret: DEV_KEYCLOAK.clientSecret,
      version: DEV_KEYCLOAK.version,
      legacyReturnUrl: 'http://localhost/',
      attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
    },
  })
  expect([200, 201], 'PUT /identity-provider').toContain(saved.status())
}
