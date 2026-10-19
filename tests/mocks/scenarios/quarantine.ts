// UI 006 base state and scenarios (T026, T040, T059, research R28). The world is UI 004's: ten
// domains (example.org with its alias domain example.net, example.com with example.eu, …), the
// mailboxes anna, bob, alice, carol and dave@example.org, erik and fiona@example.com,
// gina@other.example and hank@shop.example, three resources, and the domain administrator
// "reseller" of example.org and example.com. On top: the quarantine active (20 items, 15 MiB), the
// domain block entry `*@spam.example` of example.org, the domain rate limit 100 / hour of
// example.org, the bucket `RLabc=`, and the items of each scenario. Story modules build their own
// scenarios from `setupQuarantineWorld` and the exported item builders, and change the state at
// runtime with `{ quarantine: QuarantinePatch }` (`applyQuarantineOverrides`).
import type { PermissionFlags } from '@/api'

import { asciiName } from '../factories/domain'
import { addressOf, normaliseAddress } from '../factories/mailbox'
import {
  defaultQuarantineCapabilities,
  mergeCapabilities,
} from '../factories/quarantine-capabilities'
import { hostileQuarantineItems } from '../factories/hostile-messages'
import {
  ALICE,
  aliceQuarantineItems,
  generateQuarantineItems,
  mockQuarantineItem,
} from '../factories/quarantine-item'
import { activeQuarantineSettings, freshQuarantineSettings } from '../factories/quarantine-settings'
import { mockSpamPolicyEntry } from '../factories/spam-policy-entry'
import { reportedSpamScoreDefaults } from '../factories/spam-score'
import { spamStatistics } from '../factories/spam-statistics'
import { ensureMailboxes } from '../handlers/mailbox-rules'
import { DOMAIN_ADMIN_004, setupWorld004 } from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type {
  MockQuarantineItem,
  MockQuarantineState,
  QuarantinePatch,
  ScenarioPatch,
  ScenarioState,
} from './state'

export { ALICE, QUARANTINE_ITEM } from '../factories/quarantine-item'

/** The domain administrator of UI 004's world: example.org and example.com. */
export const QUARANTINE_DOMAIN_ADMIN = DOMAIN_ADMIN_004
export const BOB = 'bob@example.org'

/** The six mailbox flags of FR-002. */
export const MAILBOX_QUARANTINE_FLAGS = [
  'quarantine',
  'quarantineAttachments',
  'quarantineNotification',
  'quarantineCategory',
  'spamScore',
  'spamPolicy',
] as const satisfies readonly (keyof PermissionFlags)[]

/** The three domain administrator flags of FR-002. */
export const DOMAIN_ADMIN_QUARANTINE_FLAGS = [
  'quarantine',
  'spamPolicy',
  'ratelimit',
] as const satisfies readonly (keyof PermissionFlags)[]

/** UI 006 state of a fresh scenario: a server on which nothing was saved and no items. */
export function initialQuarantineState(): { quarantine: MockQuarantineState } {
  return {
    quarantine: {
      capabilities: defaultQuarantineCapabilities(),
      settings: freshQuarantineSettings(),
      items: [],
      lastItemId: 0,
      spamScores: {},
      spamScoreDefaults: reportedSpamScoreDefaults(),
      entries: [],
      lastEntryId: 0,
      invalidRateLimits: {},
      buckets: [],
      statistics: spamStatistics(),
      noCategory: [],
    },
  }
}

/** Sets permission flags of an account (merged). */
export function setFlags(
  state: ScenarioState,
  username: string,
  flags: Partial<PermissionFlags>,
): void {
  const account = state.accounts.find(
    (item) => item.username.toLowerCase() === username.toLowerCase(),
  )
  if (!account) throw new Error(`Unknown mock account ${username}`)
  account.permissions = { ...account.permissions, ...flags }
}

const all = <K extends string>(keys: readonly K[], value: boolean) =>
  Object.fromEntries(keys.map((key) => [key, value])) as Record<K, boolean>

/** Replaces the items, keeping `lastItemId` ahead of them. */
export function withItems(state: ScenarioState, items: MockQuarantineItem[]): void {
  state.quarantine.items = items
  state.quarantine.lastItemId = Math.max(0, ...items.map((item) => item.id))
}

export interface QuarantineWorldOptions {
  /** The items (default: alice's 30 items). */
  items?: MockQuarantineItem[]
  /** alice's flags (default: all six on). */
  aliceFlags?: Partial<PermissionFlags>
  /** reseller's flags (default: quarantine, spamPolicy and ratelimit on). */
  resellerFlags?: Partial<PermissionFlags>
  /** The quarantine is inactive (retention 0). */
  inactive?: boolean
}

/** The UI 006 world (see the file comment). */
export function setupQuarantineWorld(
  state: ScenarioState,
  options: QuarantineWorldOptions = {},
): void {
  setupWorld004(state)
  ensureMailboxes(state)
  setFlags(state, ALICE, { ...all(MAILBOX_QUARANTINE_FLAGS, true), ...options.aliceFlags })
  setFlags(state, QUARANTINE_DOMAIN_ADMIN, {
    ...all(DOMAIN_ADMIN_QUARANTINE_FLAGS, true),
    quarantineAttachments: true,
    ...options.resellerFlags,
  })
  state.quarantine.settings = options.inactive
    ? { ...activeQuarantineSettings(), retentionPerMailbox: 0 }
    : activeQuarantineSettings()
  withItems(state, options.items ?? aliceQuarantineItems())
  state.quarantine.entries = [
    mockSpamPolicyEntry({
      id: 1,
      list: 'block',
      ownerKind: 'domain',
      owner: 'example.org',
      pattern: '*@spam.example',
    }),
  ]
  state.quarantine.lastEntryId = 1
  const exampleOrg = state.domains.find((domain) => domain.name === 'example.org')
  if (exampleOrg) exampleOrg.rateLimit = { value: 100, frame: 'hour' }
  state.quarantine.buckets = ['RLabc=']
}

/** The recipients of `quarantine-many`: mailboxes of five domains, one of them deleted. */
export const MANY_RECIPIENTS = [
  'anna@example.org',
  'bob@example.org',
  'alice@example.org',
  'carol@example.org',
  'erik@example.com',
  'fiona@example.com',
  'gina@other.example',
  'hank@shop.example',
  'gone@alpha.example',
] as const

/** The 50 items of `quarantine-bulk-failures` (ids 101-150) and their injections. */
export const BULK_FAILURE_ITEM = {
  removedElsewhere: 150,
  busy: 149,
  deliveryRefused: 148,
  temporaryFailure: 147,
  outdated: 146,
  learningFailed: 145,
} as const

export function bulkFailureItems(): MockQuarantineItem[] {
  const items = generateQuarantineItems(MANY_RECIPIENTS.slice(0, 4), 50, 101, 61).map((item) => ({
    ...item,
    virus: false,
  }))
  const inject = (id: number, value: MockQuarantineItem['inject']) => {
    const item = items.find((entry) => entry.id === id)!
    item.inject = value
  }
  inject(BULK_FAILURE_ITEM.removedElsewhere, { removedElsewhere: true })
  inject(BULK_FAILURE_ITEM.busy, { busy: { then: 'available' } })
  inject(BULK_FAILURE_ITEM.deliveryRefused, { deliveryRefused: {} })
  inject(BULK_FAILURE_ITEM.temporaryFailure, {
    temporaryFailure: { dependency: 'mailServer', step: 'delivery' },
  })
  inject(BULK_FAILURE_ITEM.outdated, { outdated: true })
  inject(BULK_FAILURE_ITEM.learningFailed, { learning: 'failed' })
  return items
}

// ---------------------------------------------------------------------------------------------
// Overrides and runtime patches

function findMailboxRecord(state: ScenarioState, address: string) {
  ensureMailboxes(state)
  const wanted = normaliseAddress(address)
  const mailbox = state.mailboxes.find((item) => addressOf(item) === wanted)
  if (!mailbox) throw new Error(`Unknown mock mailbox ${address}`)
  return mailbox
}

function applyRateLimits(state: ScenarioState, patch: NonNullable<QuarantinePatch['rateLimits']>) {
  for (const [name, limit] of Object.entries(patch.domain ?? {})) {
    const domain = state.domains.find((item) => item.name === (asciiName(name) || name))
    if (!domain) throw new Error(`Unknown mock domain ${name}`)
    domain.rateLimit = limit
  }
  for (const [name, limit] of Object.entries(patch.aliasDomain ?? {})) {
    const item = state.aliasDomains.find((entry) => entry.name === (asciiName(name) || name))
    if (!item) throw new Error(`Unknown mock alias domain ${name}`)
    item.rateLimit = limit
  }
  for (const [address, limit] of Object.entries(patch.mailbox ?? {})) {
    findMailboxRecord(state, address).rateLimit = limit
  }
}

function nextItemId(state: ScenarioState, given?: number): number {
  const id = given ?? state.quarantine.lastItemId + 1
  state.quarantine.lastItemId = Math.max(state.quarantine.lastItemId, id)
  return id
}

function applyItems(state: ScenarioState, patch: NonNullable<QuarantinePatch['items']>) {
  const q = state.quarantine
  if (patch.replace) {
    q.items = []
    q.lastItemId = 0
    for (const item of patch.replace) {
      q.items.push(mockQuarantineItem({ ...item, id: nextItemId(state, item.id) }))
    }
  }
  for (const item of patch.add ?? []) {
    q.items.push(mockQuarantineItem({ ...item, id: nextItemId(state, item.id) }))
  }
  for (const [id, change] of Object.entries(patch.set ?? {})) {
    const item = q.items.find((entry) => entry.id === Number(id))
    if (!item) throw new Error(`Unknown mock quarantine item ${id}`)
    const { inject, ...rest } = change
    Object.assign(item, rest)
    if (inject === null) delete item.inject
    else if (inject) item.inject = { ...item.inject, ...inject }
  }
  const removed = new Set(patch.remove ?? [])
  q.items = q.items.filter((item) => !removed.has(item.id))
}

function applyEntries(state: ScenarioState, patch: NonNullable<QuarantinePatch['entries']>) {
  const q = state.quarantine
  const create = (entry: NonNullable<typeof patch.add>[number]) => {
    const id = entry.id ?? q.lastEntryId + 1
    q.lastEntryId = Math.max(q.lastEntryId, id)
    return mockSpamPolicyEntry({ ...entry, id })
  }
  if (patch.replace) {
    q.entries = []
    q.lastEntryId = 0
    q.entries = patch.replace.map(create)
  }
  for (const entry of patch.add ?? []) q.entries.push(create(entry))
  const removed = new Set(patch.remove ?? [])
  q.entries = q.entries.filter((entry) => !removed.has(entry.id))
}

/** UI 006 overrides and runtime patches (`{ quarantine: … }`). */
export function applyQuarantineOverrides(state: ScenarioState, overrides: ScenarioPatch): void {
  const patch = overrides.quarantine
  if (!patch) return
  const q = state.quarantine
  if (patch.capabilities) q.capabilities = mergeCapabilities(q.capabilities, patch.capabilities)
  if (patch.settings) {
    q.settings = { ...q.settings, ...patch.settings }
  }
  if (patch.items) applyItems(state, patch.items)
  for (const [address, score] of Object.entries(patch.spamScores ?? {})) {
    const key = normaliseAddress(address)
    if (score === null) delete q.spamScores[key]
    else q.spamScores[key] = score
  }
  if (patch.spamScoreDefaults) {
    q.spamScoreDefaults = { ...q.spamScoreDefaults, ...patch.spamScoreDefaults }
  }
  if (patch.entries) applyEntries(state, patch.entries)
  if (patch.rateLimits) applyRateLimits(state, patch.rateLimits)
  for (const [raw, text] of Object.entries(patch.invalidRateLimits ?? {})) {
    const separator = raw.indexOf(':')
    const key = `${raw.slice(0, separator)}:${raw.slice(separator + 1).toLowerCase()}`
    if (text === null) delete q.invalidRateLimits[key]
    else q.invalidRateLimits[key] = text
  }
  if (patch.buckets) q.buckets = [...patch.buckets]
  if (patch.statistics) q.statistics = patch.statistics
  if (patch.noCategory) q.noCategory = patch.noCategory.map((address) => normaliseAddress(address))
}

// ---------------------------------------------------------------------------------------------
// Scenarios

const asAlice = { signedInAs: ALICE }

export const quarantineScenarios: Record<string, ScenarioDefinition> = {
  'quarantine-mailbox-user': {
    description:
      'alice@example.org with all six quarantine and spam flags and 30 items of every kind (QUARANTINE_ITEM: virus 5, attachments 6, unparseable 9, missing 10, script 11, markup 12, right-to-left 13, long text 14, over 10 MiB 29), the quarantine active (20 items, 15 MiB) (UI 006 US1).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state),
  },
  'quarantine-user-no-actions': {
    description: 'alice without the "Quarantine actions" flag (`quarantine`), 30 items (US1-AS8).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state, { aliceFlags: { quarantine: false } }),
  },
  'quarantine-user-no-attachments': {
    description: 'alice without "Quarantine attachments" (`quarantineAttachments`) (US1-AS9).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state, { aliceFlags: { quarantineAttachments: false } }),
  },
  'quarantine-user-no-flags': {
    description: 'alice without any of the six quarantine and spam flags, 30 items.',
    overrides: asAlice,
    setup: (state) =>
      setupQuarantineWorld(state, { aliceFlags: all(MAILBOX_QUARANTINE_FLAGS, false) }),
  },
  'quarantine-inactive': {
    description: 'alice with 30 items while the quarantine is inactive (retention 0) (US1-AS11).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state, { inactive: true }),
  },
  'quarantine-hostile': {
    description:
      'alice with one item per vector of the hostile corpus (ids 1001 onwards), each vector as subject, From, sender, symbol option, file name and text (SC-002).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state, { items: hostileQuarantineItems(1001) }),
  },
  'quarantine-empty': {
    description: 'alice with an empty quarantine (FR-017).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state, { items: [] }),
  },
  'quarantine-admin': {
    description:
      "The administrator with alice's 30 items and 5 items of bob@example.org (ids 31-35) (US2).",
    overrides: { signedInAs: 'admin' },
    setup: (state) =>
      setupQuarantineWorld(state, {
        items: [...aliceQuarantineItems(), ...generateQuarantineItems([BOB], 5, 31, 7)],
      }),
  },
  'quarantine-domain-admin': {
    description:
      'The domain administrator "reseller" of example.org and example.com (two of the five domains of 250 items, ids 101-350) with quarantine, spamPolicy and ratelimit (US2-AS1).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) =>
      setupQuarantineWorld(state, { items: generateQuarantineItems(MANY_RECIPIENTS, 250, 101) }),
  },
  'quarantine-domain-admin-no-actions': {
    description: 'The domain administrator without the `quarantine` flag, 250 items (US2-AS6).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) =>
      setupQuarantineWorld(state, {
        items: generateQuarantineItems(MANY_RECIPIENTS, 250, 101),
        resellerFlags: { quarantine: false },
      }),
  },
  'quarantine-many': {
    description:
      'The administrator with 250 items (ids 101-350) across example.org, example.com, other.example, shop.example and alpha.example (a deleted mailbox) (US2).',
    overrides: { signedInAs: 'admin' },
    setup: (state) =>
      setupQuarantineWorld(state, { items: generateQuarantineItems(MANY_RECIPIENTS, 250, 101) }),
  },
  'quarantine-bulk-failures': {
    description:
      'The administrator with 50 items (ids 101-150): 150 removed elsewhere, 149 busy, 148 refused delivery, 147 mail server unavailable, 146 changed elsewhere, 145 learning fails (BULK_FAILURE_ITEM, FR-035).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupQuarantineWorld(state, { items: bulkFailureItems() }),
  },
  'quarantine-busy': {
    description:
      'alice whose item 1 is being processed by another request: the next action answers 409 with Retry-After 5, then the item is gone (US2-AS7).',
    overrides: asAlice,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.items.find((item) => item.id === 1)!.inject = { busy: { then: 'gone' } }
    },
  },
  'quarantine-low-bulk-limit': {
    description: 'The administrator with 250 items and a bulk limit of 10 (US2-AS4).',
    overrides: { signedInAs: 'admin', quarantine: { capabilities: { bulkLimit: 10 } } },
    setup: (state) =>
      setupQuarantineWorld(state, { items: generateQuarantineItems(MANY_RECIPIENTS, 250, 101) }),
  },
}
