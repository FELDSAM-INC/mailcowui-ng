// Domain scenarios and helpers of UI 002 (research D28). `assignDomains` keeps the identity and
// the domain list in step: it sets the assignments and the account's `scope.domains` together.
// The mutation helpers stand in for another administrator or the classic interface: every stored
// change also changes the version tag. Each story adds its scenarios in `domains-<story>.ts`.
import type { DomainCapabilities } from '@/api'

import { asciiName, emptyUsage, GIB, MIB, mockDomain, normaliseTags } from '../factories/domain'
import { mockTemplate } from '../factories/domain-template'
import { mockFooter } from '../factories/domain-footer'
import { domainAdminAccount } from './accounts'
import { setupDomains60 } from './domains-list'
import type { ScenarioDefinition } from './index'
import type {
  DomainMutations,
  FooterMutations,
  MockDomain,
  ScenarioState,
  TemplateMutations,
} from './state'

export { GIB, MIB }

export function defaultDomainCapabilities(): DomainCapabilities {
  return {
    groupwareEnabled: true,
    taggingLimit: 25,
    maxTagLength: 255,
    maxDescriptionLength: 255,
    footerTextMaxBytes: 1_048_576,
    bulkLimit: 100,
    defaultPageSize: 25,
    maxPageSize: 1000,
    quotaUnit: MIB,
    dkim: {
      defaultSelector: 'dkim',
      defaultKeySize: 2048,
      allowedKeySizes: [1024, 2048, 3072, 4096],
      dnsPublicationEnabled: false,
    },
    templateDefaults: {
      tags: [],
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
    },
  }
}

/** The Default template every installation has (API 002 FR-050). */
export const defaultTemplate = () => mockTemplate({ id: 1, name: 'Default' })

/**
 * Assigns domains to a domain administrator, creating the account when needed. The assignments
 * and the account's `scope.domains` are one value, so the identity always matches the list.
 */
export function assignDomains(state: ScenarioState, username: string, names: string[]): void {
  const domains = names.map((name) => asciiName(name) || name)
  let account = state.accounts.find((item) => item.username === username)
  if (!account) {
    account = domainAdminAccount({ username })
    state.accounts.push(account)
  }
  account.scope = { type: 'domains', domains }
}

const STORED_KEYS: (keyof MockDomain)[] = [
  'description',
  'active',
  'maxMailboxes',
  'maxAliases',
  'maxMailboxQuota',
  'domainQuota',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
  'globalAddressList',
  'tags',
]

function findDomain(state: ScenarioState, name: string): MockDomain {
  const ascii = asciiName(name) || name
  const domain = state.domains.find((item) => item.name === ascii)
  if (!domain) throw new Error(`Unknown mock domain ${name}`)
  return domain
}

export function applyDomainMutations(state: ScenarioState, mutations: DomainMutations): void {
  for (const added of mutations.add ?? []) state.domains.push(mockDomain(added))
  for (const [name, change] of Object.entries(mutations.set ?? {})) {
    const domain = findDomain(state, name)
    const { usage, tags, ...rest } = change
    const before = JSON.stringify(STORED_KEYS.map((key) => domain[key]))
    Object.assign(domain, rest)
    if (tags) domain.tags = normaliseTags(tags)
    if (usage) domain.usage = { ...domain.usage, ...usage }
    const changed = JSON.stringify(STORED_KEYS.map((key) => domain[key])) !== before
    if (changed && change.modifiedAt === undefined) {
      domain.modifiedAt = new Date(state.now()).toISOString()
    }
  }
  for (const name of mutations.addMailbox ?? []) {
    const domain = findDomain(state, name)
    domain.usage = { ...domain.usage, mailboxes: domain.usage.mailboxes + 1 }
    if (domain.mailboxAddresses) {
      domain.mailboxAddresses = [...domain.mailboxAddresses, `added${Date.now()}@${domain.name}`]
    }
  }
  for (const name of mutations.remove ?? []) {
    const ascii = asciiName(name) || name
    state.domains = state.domains.filter((item) => item.name !== ascii)
    delete state.footers[ascii]
  }
}

export function applyTemplateMutations(state: ScenarioState, mutations: TemplateMutations): void {
  for (const added of mutations.add ?? []) {
    const id = added.id ?? Math.max(0, ...state.domainTemplates.map((item) => item.id)) + 1
    state.domainTemplates.push(mockTemplate({ ...added, id }))
  }
  for (const [id, change] of Object.entries(mutations.set ?? {})) {
    const template = state.domainTemplates.find((item) => item.id === Number(id))
    if (!template) throw new Error(`Unknown mock template ${id}`)
    Object.assign(template, change, {
      tags: change.tags ? normaliseTags(change.tags) : template.tags,
      modifiedAt: change.modifiedAt ?? new Date(state.now()).toISOString(),
    })
  }
  for (const id of mutations.remove ?? []) {
    state.domainTemplates = state.domainTemplates.filter((item) => item.id !== id)
  }
}

export function applyFooterMutations(state: ScenarioState, mutations: FooterMutations): void {
  for (const [name, change] of Object.entries(mutations.set ?? {})) {
    const ascii = asciiName(name) || name
    state.footers[ascii] = mockFooter({ ...state.footers[ascii], ...change })
  }
  for (const name of mutations.remove ?? []) delete state.footers[asciiName(name) || name]
}

const ISO = (day: number, hour = 9) => new Date(Date.UTC(2026, 0, day, hour)).toISOString()

/** A busy domain with usage, for scenario data. */
export function domainWithUsage(
  name: string,
  usage: Partial<MockDomain['usage']>,
  overrides: Partial<MockDomain> = {},
): MockDomain {
  return mockDomain({ name, usage: { ...emptyUsage(), ...usage }, ...overrides })
}

export { ISO as scenarioTime }

/** The foundation's domain scenario, completed by US1 (T033) in domains-list.ts. */
export const domainsBaseScenarios: Record<string, ScenarioDefinition> = {
  'domains-60': {
    description:
      'An administrator with 60 domains: every active and relay state, tags, an IDN, a 253-character name, nearly-full and over-limit usage, zero limits, relayhosts, a rate limit, a footer and domain administrators (UI 002 US1).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupDomains60(state),
  },
}

/** Domain state of a fresh scenario: no domains, the Default template, default capabilities. */
export function initialDomainState(): Pick<
  ScenarioState,
  | 'domains'
  | 'aliasDomains'
  | 'domainTemplates'
  | 'footers'
  | 'dkimKeys'
  | 'domainCapabilities'
  | 'serverHostname'
  | 'creationReport'
  | 'domainFailures'
  | 'delays'
> {
  return {
    domains: [],
    aliasDomains: [],
    domainTemplates: [defaultTemplate()],
    footers: {},
    dkimKeys: [],
    domainCapabilities: defaultDomainCapabilities(),
    serverHostname: 'mail.example.net',
    creationReport: {},
    domainFailures: {},
    delays: {},
  }
}

export const quota = { mib: (n: number) => n * MIB, gib: (n: number) => n * GIB }
