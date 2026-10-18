// UI 002 US1 scenarios (T033): the domain list and the read-only domain page.
import { GIB, mockDomain } from '../factories/domain'
import { mockFooter } from '../factories/domain-footer'
import { assignDomains, defaultTemplate, scenarioTime } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { MockDomain, ScenarioState } from './state'

const RELAY_STATES = [
  { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false },
  { backupMx: true, relayAllRecipients: false, relayUnknownOnly: false },
  { backupMx: true, relayAllRecipients: true, relayUnknownOnly: false },
  { backupMx: true, relayAllRecipients: true, relayUnknownOnly: true },
]

/** 253 characters: three labels of 63, one of 53 and `.example`. */
export const LONG_NAME = [
  'a'.repeat(63),
  'b'.repeat(63),
  'c'.repeat(63),
  `${'d'.repeat(53)}.example`,
].join('.')

/** The domains of `domains-60` that the end-to-end tests name. */
export function specialDomains(): MockDomain[] {
  return [
    mockDomain({
      name: 'customer-a.example',
      description: 'Customer A',
      tags: ['customer-a', 'gold'],
      createdAt: scenarioTime(2),
    }),
    mockDomain({
      name: 'customer-b.example',
      description: 'Customer B',
      tags: ['customer-b'],
      active: false,
      createdAt: scenarioTime(3),
    }),
    mockDomain({
      name: 'xn--mnchen-3ya.de',
      description: 'München office',
      createdAt: scenarioTime(4),
    }),
    mockDomain({ name: LONG_NAME, createdAt: scenarioTime(5) }),
    mockDomain({
      name: 'nearly.example',
      description: 'Nearly full',
      maxMailboxes: 10,
      maxAliases: 400,
      domainQuota: 10 * GIB,
      maxMailboxQuota: 2 * GIB,
      createdAt: scenarioTime(6),
      modifiedAt: scenarioTime(20, 14),
      usage: {
        mailboxes: 8,
        resources: 0,
        aliases: 380,
        largestMailboxQuota: 2 * GIB,
        quotaAllocated: 9.5 * GIB,
        storageUsed: 7.25 * GIB,
        messages: 12_345,
      },
    }),
    mockDomain({
      name: 'over.example',
      maxMailboxes: 10,
      createdAt: scenarioTime(7),
      usage: {
        mailboxes: 12,
        resources: 0,
        aliases: 3,
        largestMailboxQuota: GIB,
        quotaAllocated: 12 * GIB,
        storageUsed: 900 * 1024 * 1024,
        messages: 40,
      },
      domainQuota: 20 * GIB,
    }),
    mockDomain({
      name: 'zero.example',
      maxMailboxes: 0,
      maxAliases: 0,
      createdAt: scenarioTime(8),
    }),
    mockDomain({
      name: 'many-tags.example',
      tags: Array.from({ length: 12 }, (_, index) => `tag-${String(index + 1).padStart(2, '0')}`),
      createdAt: scenarioTime(9),
    }),
    mockDomain({
      name: 'orphan-relay.example',
      relayhost: { id: 7, hostname: null },
      createdAt: scenarioTime(10),
    }),
    mockDomain({
      name: 'relayhost.example',
      relayhost: { id: 3, hostname: 'smtp.relay.example' },
      rateLimit: { value: 10, frame: 'hour' },
      createdAt: scenarioTime(11),
    }),
    mockDomain({ name: 'footed.example', createdAt: scenarioTime(12) }),
  ]
}

/** `count` filler domains in every combination of active and relay states. */
export function fillerDomains(count: number, start = 1): MockDomain[] {
  return Array.from({ length: count }, (_, index) => {
    const n = start + index
    return mockDomain({
      name: `domain-${String(n).padStart(4, '0')}.example`,
      active: n % 2 === 0,
      ...RELAY_STATES[n % 4],
      createdAt: new Date(Date.UTC(2025, 0, 1) + n * 3_600_000).toISOString(),
      usage: {
        mailboxes: n % 10,
        resources: 0,
        aliases: n % 50,
        largestMailboxQuota: (n % 3) * GIB,
        quotaAllocated: (n % 10) * GIB,
        storageUsed: n * 13_000_000,
        messages: n * 17,
      },
      domainQuota: 50 * GIB,
    })
  })
}

export function setupDomains60(state: ScenarioState): void {
  const special = specialDomains()
  state.domains = [...special, ...fillerDomains(60 - special.length)]
  state.domainTemplates = [defaultTemplate()]
  state.footers['footed.example'] = mockFooter({
    plain: 'Sent by Footed',
    excludedAddresses: ['ceo@footed.example', 'bot@footed.example'],
    skipReplies: true,
  })
  state.aliasDomains = [{ name: 'alias-of-nearly.example', target: 'nearly.example' }]
  assignDomains(state, 'reseller', ['customer-a.example', 'nearly.example'])
  assignDomains(state, 'helper', ['nearly.example'])
}

export const domainsListScenarios: Record<string, ScenarioDefinition> = {
  'domain-admin-two-of-ten': {
    description: 'The reseller manages 2 of 10 domains (UI 002 US1-AS6).',
    setup(state) {
      state.domains = [...specialDomains().slice(0, 2), ...fillerDomains(8)]
      assignDomains(state, 'reseller', ['customer-a.example', 'customer-b.example'])
    },
    overrides: { signedInAs: 'reseller' },
  },
  'domains-empty': {
    description: 'An administrator without any domain.',
    overrides: { signedInAs: 'admin' },
  },
  'domains-list-error': {
    description: 'listDomains answers its documented 500.',
    setup: setupDomains60,
    overrides: { signedInAs: 'admin', failures: { listDomains: { status: 500 } } },
  },
  'domains-5000': {
    description: '5,000 domains, generated when the scenario is created.',
    setup(state) {
      state.domains = fillerDomains(5000)
    },
    overrides: { signedInAs: 'admin' },
  },
}
