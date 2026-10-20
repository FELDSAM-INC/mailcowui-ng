import { expect, test } from '../../fixtures/test'

const screens = [
  {
    name: 'sign-in',
    scenario: 'anonymous-default',
    path: 'sign-in',
    ready: 'input[autocomplete^=username]',
  },
  { name: 'default landing', scenario: 'admin-operations', path: '', ready: '[data-hostname]' },
  { name: 'domains', scenario: 'domains-60', path: 'domains', ready: '[data-entry]' },
  { name: 'domain form', scenario: 'domains-60', path: 'domains/-/new', ready: 'form' },
  { name: 'mailboxes', scenario: 'admin-mailboxes-30', path: 'mailboxes', ready: '[data-entry]' },
  { name: 'aliases', scenario: 'aliases-60', path: 'aliases', ready: '[data-entry]' },
  {
    name: 'account',
    scenario: 'account-mailbox',
    path: 'account/password',
    ready: '[data-own-password]',
  },
  {
    name: 'quarantine',
    scenario: 'quarantine-mailbox-user',
    path: 'quarantine',
    ready: '[data-quarantine-item]',
  },
  {
    name: 'administrators',
    scenario: 'admins-three',
    path: 'administrators/admins',
    ready: '[data-account-row]',
  },
  {
    name: 'API keys',
    scenario: 'api-keys-many',
    path: 'api-keys',
    ready: 'main article, main tbody tr',
  },
  { name: 'sync jobs', scenario: 'sync-jobs-admin', path: 'sync-jobs', ready: '[data-entry]' },
  {
    name: 'routing',
    scenario: 'routing-admin-default',
    path: 'routing/relayhosts',
    ready: '[data-entry]',
  },
  {
    name: 'DNS',
    scenario: 'dns-admin',
    path: 'dns/dkim-keys/example.org',
    ready: '[data-dkim-record]',
  },
  {
    name: 'operations',
    scenario: 'admin-operations',
    path: 'operations/mail-queue',
    ready: '[data-list-state=ready], [data-list-state=empty]',
  },
  {
    name: 'identity provider',
    scenario: 'idp-none',
    path: 'identity-providers/provider',
    ready: '[data-setup]',
  },
  {
    name: 'OAuth2 apps',
    scenario: 'oauth2-many',
    path: 'identity-providers/oauth2-apps',
    ready: '[data-entry]',
  },
  {
    name: 'audit',
    scenario: 'audit-records',
    path: 'audit-log',
    ready: '[data-record], main [aria-label="Audit records"] > li',
  },
  { name: 'spam filter', scenario: 'spam-score-defaults', path: 'spam-filter', ready: 'main h1' },
  {
    name: 'settings catalogue',
    scenario: 'settings-admin-defaults',
    path: 'system',
    ready: 'main h1',
  },
  {
    name: 'colours',
    scenario: 'brand-colours-none',
    path: 'system/customize/colours',
    ready: '#section-brand-colours',
  },
  {
    name: 'settings form',
    scenario: 'settings-admin-defaults',
    path: 'system/password-policy',
    ready: '#section-policy',
  },
] as const
const palettes = {
  limit: {
    light: { color: '#767676', foreground: '#000000' as const },
    dark: { color: '#8f8f8f', foreground: '#000000' as const },
  },
  extreme: {
    light: { color: '#0f766e', foreground: '#ffffff' as const },
    dark: { color: '#f472b6', foreground: '#000000' as const },
  },
}
for (const [name, colours] of Object.entries(palettes)) {
  for (const screen of screens) {
    test(`T070 ${name} palette: ${screen.name}`, async ({
      page,
      mockApi,
      expectAccessible,
      expectNoHorizontalScroll,
    }) => {
      test.setTimeout(90_000)
      await mockApi.use(screen.scenario, { publicConfig: { brandColors: colours } })
      await page.goto(screen.path)
      await expect(page.locator(screen.ready).first()).toBeVisible()
      await expectAccessible()
      await expectNoHorizontalScroll()
    })
  }
}
