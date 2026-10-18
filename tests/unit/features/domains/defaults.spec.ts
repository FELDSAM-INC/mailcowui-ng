// The documented default values (UI 002 T022, research D18, FR-052): each one is the `default`
// keyword of DomainTemplateCreateRequest (API gap G29) and occurs in the description of
// DomainCreateRequest, so a contract change cannot leave them stale. The forms prefer
// `DomainCapabilities.templateDefaults`; these values are the fallback.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DOMAIN_DEFAULTS } from '@/features/domains/defaults'

const contract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as {
  components: {
    schemas: Record<
      string,
      { description: string; properties: Record<string, { default?: unknown }> }
    >
  }
}
const text = (schema: string) =>
  contract.components.schemas[schema]!.description.replace(/\s+/g, ' ')
const MIB = 1_048_576
const mib = (bytes: number) => (bytes / MIB).toLocaleString('en-GB')

describe('DOMAIN_DEFAULTS', () => {
  it('has the legacy values', () => {
    expect(DOMAIN_DEFAULTS).toEqual({
      maxMailboxes: 10,
      maxAliases: 400,
      maxMailboxQuota: 10240 * MIB,
      domainQuota: 10240 * MIB,
      active: true,
      globalAddressList: true,
      backupMx: false,
      relayAllRecipients: false,
      relayUnknownOnly: false,
      tags: [],
      rateLimit: null,
    })
  })

  it('matches the default keywords of DomainTemplateCreateRequest', () => {
    const properties = contract.components.schemas.DomainTemplateCreateRequest!.properties
    const keywords = Object.fromEntries(
      Object.entries(properties)
        .filter(([, property]) => 'default' in property)
        .map(([name, property]) => [name, property.default]),
    )
    const { tags: _tags, rateLimit: _rateLimit, ...expected } = DOMAIN_DEFAULTS
    expect(keywords).toEqual({ ...expected, dkimKeySize: 2048 })
  })

  it.each(['DomainTemplateCreateRequest', 'DomainCreateRequest'])(
    'matches the description of %s',
    (schema) => {
      const description = text(schema)
      expect(description).toContain(`${DOMAIN_DEFAULTS.maxMailboxes} mailboxes`)
      expect(description).toContain(`${DOMAIN_DEFAULTS.maxAliases} aliases`)
      expect(description).toContain(
        `${mib(DOMAIN_DEFAULTS.maxMailboxQuota)} MiB maximum mailbox quota`,
      )
      expect(description).toContain(`${mib(DOMAIN_DEFAULTS.domainQuota)} MiB domain quota`)
      expect(description).toContain('active')
      expect(description).toContain('Global Address List on')
      expect(description).toContain('no relay options')
      expect(description).toContain('no tags')
      expect(description).toContain('no rate limit')
    },
  )
})
