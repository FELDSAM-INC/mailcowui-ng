// UI 004 US6 scenarios (T079): mass actions and copies over alias domains. In `bulk-004` the 30
// aliases fit one page of 50; example.org has the alias domains example.net (where
// sales@example.net exists) and example.com (an alias domain here, not a domain). Deletions and
// changes after loading use `deleteElsewhere` and `changeElsewhere`.
import { mockAlias } from '../factories/alias'
import { mockAliasDomain } from '../factories/alias-domain'
import { DOMAIN_ADMIN_004, MAILBOX_004, setupWorld004, syncUsage004 } from './feature-004-base'
import { worldWithAliases } from './aliases-list'
import type { ScenarioDefinition } from './index'
import type { MockAlias, ScenarioState } from './state'

export const BULK_004 = {
  /** The 30 alias IDs of `bulk-004`, all active. */
  ids: Array.from({ length: 30 }, (_, index) => index + 1),
  /** sales@example.org → anna, bob: copies to example.com, skipped in example.net (US6-AS4). */
  sales: 1,
  /** sales@example.net, which makes the copy to example.net skip "address in use". */
  salesNet: 2,
  /** info@example.net: an alias in an alias domain, never copied. */
  inAliasDomain: 3,
  /** Five aliases for US6-AS2 and US6-AS8 (tests delete or change some of them after loading). */
  five: [4, 5, 6, 7, 8],
  /** The copy that is created. */
  copyCreated: 'sales@example.com',
  copySkippedAliasDomain: 'example.net',
} as const

/** Alias domains of example.org for alias domain mass actions. */
export const BULK_ALIAS_DOMAINS_004 = [
  'brand-a.example',
  'brand-b.example',
  'brand-c.example',
  'brand-d.example',
  'brand-e.example',
] as const

/** The two alias domains whose mass action fails with a temporary failure. */
export const FAILING_ALIAS_DOMAINS_004 = ['brand-b.example', 'brand-d.example'] as const

const members = (from: number, count: number): MockAlias[] =>
  Array.from({ length: count }, (_, index) =>
    mockAlias({
      id: from + index,
      address: `member${from + index}@example.org`,
      destinations: [MAILBOX_004.bob],
      createdAt: new Date(Date.UTC(2026, 3, 1) + (from + index) * 60_000).toISOString(),
    }),
  )

function setupBulk(state: ScenarioState): void {
  worldWithAliases(state, [
    mockAlias({
      id: 1,
      address: 'sales@example.org',
      destinations: [MAILBOX_004.anna, MAILBOX_004.bob],
    }),
    mockAlias({ id: 2, address: 'sales@example.net', destinations: [MAILBOX_004.anna] }),
    mockAlias({ id: 3, address: 'info@example.net', destinations: [MAILBOX_004.bob] }),
    ...members(4, 27),
  ])
  // example.com is an alias domain of example.org in this scenario (US6-AS4).
  state.domains = state.domains.filter((domain) => domain.name !== 'example.com')
  state.aliasDomains = [
    mockAliasDomain({ name: 'example.net', target: 'example.org' }),
    mockAliasDomain({ name: 'example.com', target: 'example.org' }),
  ]
  state.resources = state.resources.filter((resource) => !resource.address.endsWith('@example.com'))
  syncUsage004(state)
}

function withBrandDomains(state: ScenarioState): void {
  setupWorld004(state)
  state.aliasDomains.push(
    ...BULK_ALIAS_DOMAINS_004.map((name) => mockAliasDomain({ name, target: 'example.org' })),
  )
}

export const bulk004Scenarios: Record<string, ScenarioDefinition> = {
  'bulk-004': {
    description:
      'An administrator with 30 active aliases (BULK_004); example.org has the alias domains example.net (with sales@example.net) and example.com (UI 004 US6).',
    overrides: { signedInAs: 'admin' },
    setup: setupBulk,
  },
  'bulk-limit-50': {
    description: 'An administrator with 100 aliases and a bulk limit of 50 (US6-AS6).',
    overrides: { signedInAs: 'admin', capabilities004: { bulkLimit: 50 } },
    setup: (state) => worldWithAliases(state, members(1, 100)),
  },
  'bulk-100': {
    description: 'An administrator with 100 aliases and the bulk limit of 100 (SC-010).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => worldWithAliases(state, members(1, 100)),
  },
  'bulk-alias-domains-da': {
    description:
      'The domain administrator without aliasDomains, with seven alias domains in scope (US6-AS7).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: withBrandDomains,
  },
  'bulk-alias-domains-failures': {
    description:
      'An administrator; mass actions on brand-b.example and brand-d.example fail with a temporary failure.',
    overrides: {
      signedInAs: 'admin',
      domainFailures: Object.fromEntries(
        FAILING_ALIAS_DOMAINS_004.map((name) => [
          name,
          { status: 503, type: 'temporary-failure', operations: ['applyAliasDomainBulkAction'] },
        ]),
      ),
    },
    setup: withBrandDomains,
  },
}
