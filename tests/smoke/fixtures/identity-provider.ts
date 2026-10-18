// Set-up and clean-up of the UI 012 identity provider smoke tests through the real API (research
// R25): the mailbox template "Staff" for the mapping, and the identity provider configuration,
// removed before and after a test when no mailbox uses it. It uses the page's session cookie and a
// fresh anti-forgery token, so it acts as the signed-in administrator. Test code only.
import { expect, type Page } from '@playwright/test'

/** The API dev stack's OpenLDAP of the `idp` profile (mailcow-rest-v2 compose.yaml). */
export const DEV_LDAP = {
  host: 'openldap',
  baseDn: 'dc=example,dc=org',
  bindDn: 'cn=admin,dc=example,dc=org',
  bindPassword: 'ldap-secret',
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

/** Stores the dev stack's LDAP directory as the identity provider (US3's precondition). */
export async function configureDevLdap(page: Page): Promise<void> {
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
    },
  })
  expect([200, 201], 'PUT /identity-provider').toContain(saved.status())
}
