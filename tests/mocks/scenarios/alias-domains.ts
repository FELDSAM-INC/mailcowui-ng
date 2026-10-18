// UI 004 US4 scenarios (T059): managing alias domains. example.net (of example.org) holds 7 aliases;
// legacy.example targets relay.example, which became a relay domain; moving example.net to
// example.com would exceed example.com's alias limit; the server's host name is mail.example.net.
import { mockAlias } from '../factories/alias'
import { mockAliasDomain } from '../factories/alias-domain'
import {
  DOMAIN_ADMIN_004,
  MAILBOX_004,
  setDomainAdminFlags,
  setupWorld004,
  syncUsage004,
} from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export const ALIAS_DOMAINS_SCENARIO = {
  /** The alias domain with 7 aliases (US4-AS8). */
  withAliases: 'example.net',
  aliasCount: 7,
  /** Its target. */
  target: 'example.org',
  /** An alias domain whose target became a relay domain (US4-AS9). */
  relayTargeted: 'legacy.example',
  relayDomain: 'relay.example',
  /** A target whose alias limit the 7 aliases would exceed (US4-AS7): 1 of 5 in use. */
  limitedTarget: 'example.com',
  limitedCount: 1,
  limitedLimit: 5,
  /** Names that already exist (US4-AS5). */
  existingDomain: 'example.com',
  existingAliasDomain: 'example.net',
  /** The server's own host name (`reserved`). */
  serverHostname: 'mail.example.net',
} as const

const EXTRA_LOCALS = ['sales', 'support', 'jobs', 'press', 'team', 'hello']

function setupAliasDomains(state: ScenarioState): void {
  setupWorld004(state)
  state.aliasDomains.push(
    mockAliasDomain({
      name: ALIAS_DOMAINS_SCENARIO.relayTargeted,
      target: ALIAS_DOMAINS_SCENARIO.relayDomain,
    }),
  )
  state.aliases.push(
    ...EXTRA_LOCALS.map((local, index) =>
      mockAlias({
        id: 30 + index,
        address: `${local}@example.net`,
        destinations: [MAILBOX_004.bob],
      }),
    ),
  )
  state.lastAliasId = Math.max(...state.aliases.map((alias) => alias.id))
  state.domains.find((domain) => domain.name === 'example.com')!.maxAliases =
    ALIAS_DOMAINS_SCENARIO.limitedLimit
  state.serverHostname = ALIAS_DOMAINS_SCENARIO.serverHostname
  syncUsage004(state)
}

function asDomainAdmin(flags: { aliasDomains: boolean; ratelimit: boolean }) {
  return (state: ScenarioState) => {
    setupAliasDomains(state)
    setDomainAdminFlags(state, false)
    const account = state.accounts.find((item) => item.username === DOMAIN_ADMIN_004)!
    account.permissions = { ...account.permissions, ...flags }
  }
}

export const aliasDomainScenarios: Record<string, ScenarioDefinition> = {
  'alias-domains': {
    description:
      'The domain administrator of example.org and example.com with aliasDomains and ratelimit; example.net has 7 aliases (UI 004 US4).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: asDomainAdmin({ aliasDomains: true, ratelimit: true }),
  },
  'alias-domains-admin': {
    description:
      'An administrator with the alias domains of `alias-domains`, among them legacy.example, whose target became a relay domain (US4-AS9).',
    overrides: { signedInAs: 'admin' },
    setup: setupAliasDomains,
  },
  'alias-domains-dkim-failed': {
    description: 'As `alias-domains`; the DKIM key of a new alias domain fails (US4-AS2).',
    overrides: {
      signedInAs: DOMAIN_ADMIN_004,
      aliasDomainCreationOutcomes: { dkimKey: 'failed', dkimDnsPublication: 'skipped' },
    },
    setup: asDomainAdmin({ aliasDomains: true, ratelimit: true }),
  },
  'alias-domains-feldhost': {
    description:
      'An administrator; the server default DKIM selector is feldhost with 2048 bits (US4-AS10).',
    overrides: {
      signedInAs: 'admin',
      capabilities004: { dkimDefaults: { selector: 'feldhost', keySize: 2048 } },
    },
    setup: setupAliasDomains,
  },
  'alias-domains-da-no-flags': {
    description: 'The domain administrator without aliasDomains and ratelimit (US4-AS3).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: asDomainAdmin({ aliasDomains: false, ratelimit: false }),
  },
  'alias-domains-da-no-ratelimit': {
    description: 'The domain administrator with aliasDomains but without ratelimit (US4-AS4).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: asDomainAdmin({ aliasDomains: true, ratelimit: false }),
  },
  'alias-domains-store-down': {
    description:
      "An administrator while mailcow's shared store is down: alias domain operations answer 503.",
    overrides: { signedInAs: 'admin', sharedStoreDown: true },
    setup: setupAliasDomains,
  },
}
