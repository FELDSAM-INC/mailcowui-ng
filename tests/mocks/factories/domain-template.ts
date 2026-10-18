// Domain template factory (UI 002 research D28): the legacy defaults, the protected Default
// template (its name compared ignoring letter case) and a version tag of the stored name and values.
import { createHash } from 'node:crypto'

import type { DomainTemplate } from '@/api'

import type { MockDomainTemplate } from '../scenarios/state'
import { MIB, normaliseTags } from './domain'

/** A stored template with the legacy defaults of `DomainTemplateCreateRequest`, overridden. */
export function mockTemplate(
  overrides: Partial<MockDomainTemplate> & { id: number; name: string },
): MockDomainTemplate {
  return {
    maxMailboxes: 10,
    maxAliases: 400,
    maxMailboxQuota: 10240 * MIB,
    domainQuota: 10240 * MIB,
    rateLimit: null,
    active: true,
    globalAddressList: true,
    backupMx: false,
    relayAllRecipients: false,
    relayUnknownOnly: false,
    dkimSelector: 'dkim',
    dkimKeySize: 2048,
    createdAt: '2026-01-02T09:00:00.000Z',
    modifiedAt: null,
    ...overrides,
    tags: normaliseTags(overrides.tags ?? []),
  }
}

export const isDefaultTemplate = (template: { name: string }) =>
  template.name.toLowerCase() === 'default'

export function templateEtag(template: MockDomainTemplate): string {
  const { createdAt: _c, modifiedAt: _m, ...stored } = template
  return `"t${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}

export function templateView(template: MockDomainTemplate): DomainTemplate {
  return {
    ...template,
    tags: [...template.tags],
    rateLimit: template.rateLimit ? { ...template.rateLimit } : null,
    isDefault: isDefaultTemplate(template),
    etag: templateEtag(template),
  }
}
