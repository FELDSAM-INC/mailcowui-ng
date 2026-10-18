// UI 004 base scenarios and helpers (T015, T018, research R21). One world of ten domains with their
// mailboxes, two alias domains, a few aliases, resources and sender permissions; the helpers keep
// UI 002's alias and resource usage figures in step with the stored aliases and resources, and apply
// the runtime changes that stand in for another administrator or the classic interface (every
// stored change also changes the object's version tag).
import type { AliasCapabilities } from '@/api'

import { domainPart, mockAlias, normaliseAddress } from '../factories/alias'
import { mockAliasDomain } from '../factories/alias-domain'
import { emptyUsage, mockDomain } from '../factories/domain'
import { mockResource } from '../factories/resource'
import { senderAclRows } from '../factories/sender-acl'
import {
  adjustAliasUsage,
  domainKey,
  findAliasDomain,
  primaryDomainOf,
  removeAlias,
  removeAliasDomain,
  removeResource,
} from '../handlers/feature-004-rules'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { MockAlias, MockDomain, ScenarioPatch, ScenarioState } from './state'

export const DOMAIN_ADMIN_004 = 'reseller'

/** The domain administrator's two domains of `domain-admin-004`. */
export const DOMAIN_ADMIN_DOMAINS_004 = ['example.org', 'example.com'] as const

export const MAILBOX_004 = {
  anna: 'anna@example.org',
  bob: 'bob@example.org',
  alice: 'alice@example.org',
  carol: 'carol@example.org',
  dave: 'dave@example.org',
  erik: 'erik@example.com',
  fiona: 'fiona@example.com',
  gina: 'gina@other.example',
  hank: 'hank@shop.example',
} as const

/** The ten domains of the world, in creation order. */
export const DOMAINS_004 = [
  'example.org',
  'example.com',
  'other.example',
  'shop.example',
  'relay.example',
  'xn--bcher-kva.example',
  'alpha.example',
  'beta.example',
  'gamma.example',
  'delta.example',
] as const

/** Alias domains: example.net of example.org, example.eu of example.com. */
export const ALIAS_DOMAINS_004 = [
  { name: 'example.net', target: 'example.org' },
  { name: 'example.eu', target: 'example.com' },
] as const

export const ALIAS_004 = {
  /** sales@example.org → anna, bob (sending allowed). */
  sales: 1,
  /** info@example.org → anna (receive-only). */
  info: 2,
  /** @example.org → anna (catch-all). */
  catchAll: 3,
  /** noreply@example.org: discard. */
  noreply: 4,
  /** info@example.net → bob (in the alias domain example.net). */
  infoNet: 5,
  /** contact@other.example → gina (outside the domain administrator's scope). */
  contact: 6,
  /** lost@gone.example → anna (orphaned: gone.example no longer exists). */
  orphaned: 7,
  /** shared@example.com → erik (sending allowed). */
  shared: 8,
} as const

export const RESOURCE_004 = {
  meetingRoom: 'MeetingRoom1@example.org',
  projector: 'Projector@example.com',
  teamCalendar: 'TeamCalendar@other.example',
} as const

export const TEMPORARY_ALIAS_004 = 'spam9f3k2@example.org'

export function defaultCapabilities004(): AliasCapabilities {
  return {
    groupwareEnabled: true,
    externalDestinationsDisabled: false,
    bulkLimit: 100,
    defaultPageSize: 25,
    maxPageSize: 1000,
    commentMaxBytes: 160,
    destinationsMaxLength: 65535,
    resourceDescriptionMaxLength: 255,
    resourceBookingLimit: { min: 1, max: 2147483647 },
    rateLimitFrames: ['second', 'minute', 'hour', 'day'],
    dkimKeySizes: [1024, 2048, 3072, 4096],
    dkimDefaults: { selector: 'dkim', keySize: 2048 },
    dkimDnsPublicationEnabled: false,
  }
}

/** UI 004 state of a fresh scenario: no aliases, resources or permissions, default capabilities. */
export function initialState004(): Pick<
  ScenarioState,
  | 'aliases'
  | 'lastAliasId'
  | 'resources'
  | 'senderAcl'
  | 'temporaryAliasAddresses'
  | 'capabilities004'
  | 'aliasDomainCreationOutcomes'
  | 'sharedStoreDown'
> {
  return {
    aliases: [],
    lastAliasId: 0,
    resources: [],
    senderAcl: [],
    temporaryAliasAddresses: [],
    capabilities004: defaultCapabilities004(),
    aliasDomainCreationOutcomes: {},
    sharedStoreDown: false,
  }
}

const MAILBOXES: Record<string, string[]> = {
  'example.org': ['anna', 'bob', 'alice', 'carol', 'dave'],
  'example.com': ['erik', 'fiona'],
  'other.example': ['gina'],
  'shop.example': ['hank'],
}

/** A world domain with explicit mailboxes and usage in step with them. */
export function worldDomain(name: string, overrides: Partial<MockDomain> = {}): MockDomain {
  const mailboxAddresses = (MAILBOXES[name] ?? []).map((local) => `${local}@${name}`)
  return mockDomain({
    name,
    description: name,
    mailboxAddresses,
    createdAt: '2026-01-05T08:00:00.000Z',
    ...overrides,
    usage: { ...emptyUsage(), mailboxes: mailboxAddresses.length, ...overrides.usage },
  })
}

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 1, day, hour)).toISOString()

/** The aliases of the base world (`ALIAS_004`). */
export function worldAliases(): MockAlias[] {
  return [
    mockAlias({
      id: ALIAS_004.sales,
      address: 'sales@example.org',
      destinations: [MAILBOX_004.anna, MAILBOX_004.bob],
      createdAt: at(1),
    }),
    mockAlias({
      id: ALIAS_004.info,
      address: 'info@example.org',
      destinations: [MAILBOX_004.anna],
      senderAllowed: false,
      createdAt: at(2),
    }),
    mockAlias({
      id: ALIAS_004.catchAll,
      address: '@example.org',
      destinations: [MAILBOX_004.anna],
      createdAt: at(3),
    }),
    mockAlias({
      id: ALIAS_004.noreply,
      address: 'noreply@example.org',
      destinationType: 'discard',
      createdAt: at(4),
    }),
    mockAlias({
      id: ALIAS_004.infoNet,
      address: 'info@example.net',
      destinations: [MAILBOX_004.bob],
      createdAt: at(5),
    }),
    mockAlias({
      id: ALIAS_004.contact,
      address: 'contact@other.example',
      destinations: [MAILBOX_004.gina],
      createdAt: at(6),
    }),
    mockAlias({
      id: ALIAS_004.orphaned,
      address: 'lost@gone.example',
      destinations: [MAILBOX_004.anna],
      createdAt: at(7),
    }),
    mockAlias({
      id: ALIAS_004.shared,
      address: 'shared@example.com',
      destinations: [MAILBOX_004.erik],
      createdAt: at(8),
    }),
  ]
}

/**
 * UI 002's figures that UI 004 changes: each domain's aliases in use (aliases of the domain and its
 * alias domains) and resources, recomputed from the stored aliases and resources.
 */
export function syncUsage004(state: ScenarioState): void {
  for (const domain of state.domains) {
    const aliases = state.aliases.filter(
      (alias) => primaryDomainOf(state, domainPart(alias.address)) === domain.name,
    ).length
    const resources = state.resources.filter(
      (resource) => domainPart(resource.address) === domain.name,
    ).length
    domain.usage = { ...domain.usage, aliases, resources }
  }
}

export interface WorldOptions {
  /** Leave out the base aliases (scenarios that bring their own). */
  aliases?: boolean
  /** The domain administrator's flags `aliasDomains`, `aliasExternalGoto`, `extendSenderAcl`, `ratelimit`. */
  domainAdminFlags?: boolean
}

/** The base world of UI 004 (T018). */
export function setupWorld004(state: ScenarioState, options: WorldOptions = {}): void {
  state.domains = DOMAINS_004.map((name) =>
    worldDomain(name, name === 'relay.example' ? { backupMx: true } : {}),
  )
  state.aliasDomains = ALIAS_DOMAINS_004.map((item) => mockAliasDomain(item))
  state.aliases = options.aliases === false ? [] : worldAliases()
  state.lastAliasId = Math.max(0, ...state.aliases.map((alias) => alias.id))
  state.resources = [
    mockResource({ description: 'Meeting Room 1', domain: 'example.org', kind: 'location' }),
    mockResource({
      description: 'Projector',
      domain: 'example.com',
      kind: 'thing',
      bookingRule: 'alwaysFree',
    }),
    mockResource({
      description: 'Team Calendar',
      domain: 'other.example',
      kind: 'group',
      bookingRule: 'limited',
      bookingLimit: 2,
    }),
  ]
  state.senderAcl = [
    ...senderAclRows(
      MAILBOX_004.anna,
      ['@example.com', '@other.example', '@deleted.example'],
      ['news@mailer.example', '@partner.example'],
    ),
    ...senderAclRows(MAILBOX_004.erik, ['sales@example.org']),
  ]
  state.temporaryAliasAddresses = [TEMPORARY_ALIAS_004]
  syncUsage004(state)
  assignDomains(state, DOMAIN_ADMIN_004, [...DOMAIN_ADMIN_DOMAINS_004])
  setDomainAdminFlags(state, options.domainAdminFlags ?? false)
}

/** The four flags of UI 004 for the domain administrator. */
export function setDomainAdminFlags(
  state: ScenarioState,
  value: boolean,
  username = DOMAIN_ADMIN_004,
): void {
  const account = state.accounts.find((item) => item.username === username)
  if (!account) return
  account.permissions = {
    ...account.permissions,
    aliasDomains: value,
    aliasExternalGoto: value,
    extendSenderAcl: value,
    ratelimit: value,
  }
}

function findAliasByKey(state: ScenarioState, key: string | number): MockAlias | undefined {
  const text = String(key)
  if (/^\d+$/.test(text)) return state.aliases.find((alias) => alias.id === Number(text))
  const wanted = normaliseAddress(text).toLowerCase()
  return state.aliases.find((alias) => alias.address.toLowerCase() === wanted)
}

/** UI 004 overrides and runtime patches (`PATCH /__mock/scenarios/:id`). */
export function applyFeature004Overrides(state: ScenarioState, overrides: ScenarioPatch): void {
  if (overrides.aliases) {
    state.aliases = overrides.aliases.map((alias) => mockAlias(structuredClone(alias)))
    state.lastAliasId = Math.max(state.lastAliasId, ...state.aliases.map((alias) => alias.id))
  }
  if (overrides.resources) {
    state.resources = overrides.resources.map((resource) => mockResource(structuredClone(resource)))
  }
  if (overrides.senderAcl) state.senderAcl = structuredClone(overrides.senderAcl)
  if (overrides.temporaryAliasAddresses) {
    state.temporaryAliasAddresses = [...overrides.temporaryAliasAddresses]
  }
  if (overrides.capabilities004) {
    state.capabilities004 = {
      ...state.capabilities004,
      ...structuredClone(overrides.capabilities004),
    }
  }
  if (overrides.aliasDomainCreationOutcomes) {
    state.aliasDomainCreationOutcomes = {
      ...state.aliasDomainCreationOutcomes,
      ...overrides.aliasDomainCreationOutcomes,
    }
  }
  if (overrides.sharedStoreDown !== undefined) state.sharedStoreDown = overrides.sharedStoreDown
  for (const [username, flags] of Object.entries(overrides.flags ?? {})) {
    const account = state.accounts.find((item) => item.username === username)
    if (!account) throw new Error(`Unknown account ${username}`)
    account.permissions = { ...account.permissions, ...flags }
  }
  if (overrides.changeElsewhere) applyChangesElsewhere(state, overrides.changeElsewhere)
  if (overrides.deleteElsewhere) applyDeletionsElsewhere(state, overrides.deleteElsewhere)
}

function applyChangesElsewhere(
  state: ScenarioState,
  changes: NonNullable<ScenarioPatch['changeElsewhere']>,
): void {
  const stamp = new Date(state.now()).toISOString()
  for (const [key, change] of Object.entries(changes.alias ?? {})) {
    const alias = findAliasByKey(state, key)
    if (!alias) throw new Error(`Unknown mock alias ${key}`)
    const oldPrimary = primaryDomainOf(state, domainPart(alias.address))
    const next = { ...change }
    if (next.destinations && !next.destinationType) next.destinationType = 'addresses'
    if (next.address) next.address = normaliseAddress(next.address)
    Object.assign(alias, next, { modifiedAt: change.modifiedAt ?? stamp })
    const newPrimary = primaryDomainOf(state, domainPart(alias.address))
    if (newPrimary !== oldPrimary) {
      adjustAliasUsage(state, oldPrimary, -1)
      adjustAliasUsage(state, newPrimary, 1)
    }
  }
  for (const [key, change] of Object.entries(changes.aliasDomain ?? {})) {
    const item = findAliasDomain(state, domainKey(key) || key)
    if (!item) throw new Error(`Unknown mock alias domain ${key}`)
    Object.assign(item, change, { modifiedAt: change.modifiedAt ?? stamp })
  }
  for (const [key, change] of Object.entries(changes.resource ?? {})) {
    const wanted = normaliseAddress(key).toLowerCase()
    const resource = state.resources.find((item) => item.address.toLowerCase() === wanted)
    if (!resource) throw new Error(`Unknown mock resource ${key}`)
    Object.assign(resource, change, { modifiedAt: change.modifiedAt ?? stamp })
  }
  for (const [mailbox, change] of Object.entries(changes.senderSettings ?? {})) {
    const key = mailbox.toLowerCase()
    if (change.explicit) {
      state.senderAcl = [
        ...state.senderAcl.filter((row) => row.external || row.mailbox.toLowerCase() !== key),
        ...senderAclRows(mailbox, change.explicit),
      ]
    }
    if (change.external) {
      state.senderAcl = [
        ...state.senderAcl.filter((row) => !row.external || row.mailbox.toLowerCase() !== key),
        ...senderAclRows(mailbox, [], change.external),
      ]
    }
  }
}

function applyDeletionsElsewhere(
  state: ScenarioState,
  deletions: NonNullable<ScenarioPatch['deleteElsewhere']>,
): void {
  for (const key of deletions.alias ?? []) {
    const alias = findAliasByKey(state, key)
    if (alias) removeAlias(state, alias)
  }
  for (const key of deletions.aliasDomain ?? []) {
    const item = findAliasDomain(state, domainKey(key) || key)
    if (item) removeAliasDomain(state, item)
  }
  for (const key of deletions.resource ?? []) {
    const wanted = normaliseAddress(key).toLowerCase()
    const resource = state.resources.find((item) => item.address.toLowerCase() === wanted)
    if (resource) removeResource(state, resource)
  }
}

export const feature004BaseScenarios: Record<string, ScenarioDefinition> = {
  'admin-004': {
    description:
      'An administrator with ten domains (example.org with the alias domain example.net, example.com with example.eu, a relay domain, an IDN), eight aliases of every kind (ALIAS_004), three resources and sender permissions of anna@example.org (UI 004).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupWorld004(state),
  },
  'domain-admin-004': {
    description:
      'The base world as the domain administrator "reseller" of example.org and example.com, with aliasDomains, aliasExternalGoto, extendSenderAcl and ratelimit off (UI 004).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: (state) => setupWorld004(state),
  },
  'domain-admin-004-all-flags': {
    description: 'The base world as the domain administrator with all four UI 004 flags on.',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: (state) => setupWorld004(state, { domainAdminFlags: true }),
  },
  'mailbox-user-004': {
    description:
      'The base world as the mailbox user alice@example.org, who has no access (UI 004).',
    overrides: { signedInAs: MAILBOX_004.alice },
    setup: (state) => setupWorld004(state),
  },
  'capabilities-unavailable': {
    description:
      'The base world as an administrator; GET /capabilities/aliases answers its documented 500.',
    overrides: { signedInAs: 'admin', failures: { getAliasesCapabilities: { status: 500 } } },
    setup: (state) => setupWorld004(state),
  },
  'groupware-disabled': {
    description: 'The base world as an administrator, with the groupware disabled on the server.',
    overrides: { signedInAs: 'admin', capabilities004: { groupwareEnabled: false } },
    setup: (state) => setupWorld004(state),
  },
  'external-destinations-disabled': {
    description:
      'The base world as an administrator, with external alias destinations disabled for every role.',
    overrides: { signedInAs: 'admin', capabilities004: { externalDestinationsDisabled: true } },
    setup: (state) => setupWorld004(state),
  },
}
