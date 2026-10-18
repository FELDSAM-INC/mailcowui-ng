// Mailbox template factory (UI 003 T009): the legacy Default template (the `init_db` values and an
// unlimited quota), "Small" (1 GiB, POP3 off, sync jobs on), arbitrary templates, the contract
// representation and a version tag of the stored name and values.
import { createHash } from 'node:crypto'

import type { MailboxTemplate, Readable } from '@/api'

import type { MockAccount, MockMailboxTemplate } from '../scenarios/state'
import { normaliseTags } from './domain'
import { ALL_PROTOCOLS, defaultUserPermissions, GIB, visiblePermissions } from './mailbox'

/** A stored template with the built-in defaults of `MailboxTemplateDefaults`, overridden. */
export function mockMailboxTemplate(
  overrides: Partial<MockMailboxTemplate> & { id: number; name: string },
): MockMailboxTemplate {
  return {
    quota: 0,
    status: 'active',
    forcePasswordChange: false,
    forceSecondFactorSetup: false,
    webmailRedirect: true,
    taggedMailHandling: 'none',
    quarantineNotification: 'hourly',
    quarantineCategory: 'rejected',
    tlsEnforceInbound: false,
    tlsEnforceOutbound: false,
    rateLimit: null,
    createdAt: '2026-01-02T09:00:00.000Z',
    modifiedAt: null,
    ...overrides,
    protocolAccess: { ...ALL_PROTOCOLS, ...overrides.protocolAccess },
    userPermissions: { ...defaultUserPermissions(), ...overrides.userPermissions },
    tags: normaliseTags(overrides.tags ?? []),
  }
}

export const defaultMailboxTemplate = () => mockMailboxTemplate({ id: 1, name: 'Default' })

export const smallMailboxTemplate = (id = 2) =>
  mockMailboxTemplate({
    id,
    name: 'Small',
    quota: GIB,
    protocolAccess: { ...ALL_PROTOCOLS, pop3: false },
    userPermissions: { ...defaultUserPermissions(), syncjobs: true },
  })

export const isDefaultMailboxTemplate = (template: { name: string }) =>
  template.name.toLowerCase() === 'default'

export function mailboxTemplateEtag(template: MockMailboxTemplate): string {
  const { createdAt: _created, ...stored } = template
  return `"t${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}

export function mailboxTemplateView(
  template: MockMailboxTemplate,
  account: MockAccount,
): Readable<MailboxTemplate> {
  return {
    id: template.id,
    name: template.name,
    isDefault: isDefaultMailboxTemplate(template),
    quota: template.quota,
    status: template.status,
    forcePasswordChange: template.forcePasswordChange,
    forceSecondFactorSetup: template.forceSecondFactorSetup,
    webmailRedirect: template.webmailRedirect,
    protocolAccess: { ...template.protocolAccess },
    userPermissions: visiblePermissions(account, template.userPermissions),
    tags: [...template.tags],
    taggedMailHandling: template.taggedMailHandling,
    quarantineNotification: template.quarantineNotification,
    quarantineCategory: template.quarantineCategory,
    tlsEnforceInbound: template.tlsEnforceInbound,
    tlsEnforceOutbound: template.tlsEnforceOutbound,
    rateLimit: template.rateLimit ? { ...template.rateLimit } : null,
    createdAt: template.createdAt,
    modifiedAt: template.modifiedAt,
    etag: mailboxTemplateEtag(template),
  }
}
