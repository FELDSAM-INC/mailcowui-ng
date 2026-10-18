// Mailbox state and the base scenarios of UI 003 (T011, research R20). Fresh scenarios have no
// stored mailboxes (the domains' usage counts are filled in on first read), the Default template,
// the legacy password policy and the default mailbox capabilities. The mutation helpers stand in
// for another administrator or the classic interface: every stored change also changes the version
// tag. Each story adds its scenarios in `mailboxes/<story>.ts`.
import type { MailboxCapabilities } from '@/api'

import { GIB, MIB, mockDomain, normaliseTags } from '../../factories/domain'
import {
  addressOf,
  defaultUserPermissions,
  generateMailboxes,
  mockMailbox,
  normaliseAddress,
  seedMailboxes,
  syncDomainUsage,
} from '../../factories/mailbox'
import {
  defaultMailboxTemplate,
  mockMailboxTemplate,
  smallMailboxTemplate,
} from '../../factories/mailbox-template'
import { defaultPasswordPolicy } from '../../factories/password-policy'
import type { ScenarioDefinition } from '../index'
import type {
  MailboxMutations,
  MailboxTemplateMutations,
  ScenarioPatch,
  ScenarioState,
} from '../state'

export const PRE_HASHED_SCHEMES = [
  'ARGON2I',
  'ARGON2ID',
  'BLF-CRYPT',
  'CLEAR',
  'CLEARTEXT',
  'CRYPT',
  'DES-CRYPT',
  'LDAP-MD5',
  'MD5',
  'MD5-CRYPT',
  'PBKDF2',
  'PLAIN',
  'PLAIN-MD4',
  'PLAIN-MD5',
  'PLAIN-TRUNC',
  'SHA',
  'SHA1',
  'SHA256',
  'SHA256-CRYPT',
  'SHA512',
  'SHA512-CRYPT',
  'SMD5',
  'SSHA',
  'SSHA256',
  'SSHA512',
]

export function defaultMailboxCapabilities(): MailboxCapabilities {
  return {
    identityProviderType: 'none',
    authSources: ['mailcow'],
    groupwareEnabled: true,
    lastLoginsReported: true,
    bulkLimit: 100,
    taggingLimit: 25,
    tagMaxLength: 255,
    customAttributeLimit: 100,
    customAttributeNameMaxLength: 255,
    customAttributeValueMaxLength: 4096,
    defaultPageSize: 25,
    maxPageSize: 1000,
    garbageRetentionMinutes: 7200,
    preHashedPasswordSchemes: [...PRE_HASHED_SCHEMES],
    templateDefaults: {
      quota: 0,
      status: 'active',
      forcePasswordChange: false,
      forceSecondFactorSetup: false,
      webmailRedirect: true,
      protocolAccess: {
        imap: true,
        pop3: true,
        smtp: true,
        sieve: true,
        activeSync: true,
        dav: true,
      },
      userPermissions: defaultUserPermissions(),
      tags: [],
      taggedMailHandling: 'none',
      quarantineNotification: 'hourly',
      quarantineCategory: 'rejected',
      tlsEnforceInbound: false,
      tlsEnforceOutbound: false,
      rateLimit: null,
    },
  }
}

/** Mailbox state of a fresh scenario. */
export function initialMailboxState(): Pick<
  ScenarioState,
  | 'mailboxes'
  | 'mailboxTemplates'
  | 'passwordPolicy'
  | 'mailboxCapabilities'
  | 'mailboxFailures'
  | 'mailboxCreationReport'
> {
  return {
    mailboxes: [],
    mailboxTemplates: [defaultMailboxTemplate()],
    passwordPolicy: defaultPasswordPolicy(),
    mailboxCapabilities: defaultMailboxCapabilities(),
    mailboxFailures: {},
    mailboxCreationReport: {},
  }
}

export function applyMailboxMutations(state: ScenarioState, mutations: MailboxMutations): void {
  const touched = new Set<string>()
  for (const added of mutations.add ?? []) {
    const mailbox = mockMailbox(added)
    state.mailboxes.push(mailbox)
    touched.add(mailbox.domain)
  }
  for (const [address, change] of Object.entries(mutations.set ?? {})) {
    const wanted = normaliseAddress(address)
    const mailbox = state.mailboxes.find((item) => addressOf(item) === wanted)
    if (!mailbox) throw new Error(`Unknown mock mailbox ${address}`)
    const { tags, protocolAccess, userPermissions, ...rest } = change
    Object.assign(mailbox, rest)
    if (tags) mailbox.tags = normaliseTags(tags)
    if (protocolAccess) mailbox.protocolAccess = { ...mailbox.protocolAccess, ...protocolAccess }
    if (userPermissions) {
      mailbox.userPermissions = { ...mailbox.userPermissions, ...userPermissions }
    }
    if (change.modifiedAt === undefined) mailbox.modifiedAt = new Date(state.now()).toISOString()
    if (change.quota !== undefined || change.quotaUsed !== undefined) touched.add(mailbox.domain)
  }
  for (const address of mutations.remove ?? []) {
    const wanted = normaliseAddress(address)
    const mailbox = state.mailboxes.find((item) => addressOf(item) === wanted)
    if (!mailbox) continue
    state.mailboxes = state.mailboxes.filter((item) => item !== mailbox)
    touched.add(mailbox.domain)
  }
  for (const name of touched) syncDomainUsage(state, name)
}

export function applyMailboxTemplateMutations(
  state: ScenarioState,
  mutations: MailboxTemplateMutations,
): void {
  for (const added of mutations.add ?? []) {
    const id = added.id ?? Math.max(0, ...state.mailboxTemplates.map((item) => item.id)) + 1
    state.mailboxTemplates.push(mockMailboxTemplate({ ...added, id }))
  }
  for (const [id, change] of Object.entries(mutations.set ?? {})) {
    const template = state.mailboxTemplates.find((item) => item.id === Number(id))
    if (!template) throw new Error(`Unknown mock mailbox template ${id}`)
    Object.assign(template, change, {
      tags: change.tags ? normaliseTags(change.tags) : template.tags,
      protocolAccess: { ...template.protocolAccess, ...change.protocolAccess },
      userPermissions: { ...template.userPermissions, ...change.userPermissions },
      modifiedAt: change.modifiedAt ?? new Date(state.now()).toISOString(),
    })
  }
  for (const id of mutations.remove ?? []) {
    state.mailboxTemplates = state.mailboxTemplates.filter((item) => item.id !== id)
  }
}

/** UI 003: mailbox data, the policy, capabilities, failures and the creation report outcomes. */
export function applyMailboxOverrides(state: ScenarioState, overrides: ScenarioPatch): void {
  if (overrides.mailboxCapabilities) {
    const { templateDefaults, ...rest } = overrides.mailboxCapabilities
    state.mailboxCapabilities = {
      ...state.mailboxCapabilities,
      ...rest,
      ...(templateDefaults
        ? {
            templateDefaults: {
              ...state.mailboxCapabilities.templateDefaults,
              ...templateDefaults,
            },
          }
        : {}),
    }
  }
  if (overrides.passwordPolicy) {
    state.passwordPolicy = { ...state.passwordPolicy, ...overrides.passwordPolicy }
  }
  for (const [key, failure] of Object.entries(overrides.mailboxFailures ?? {})) {
    if (failure === null) delete state.mailboxFailures[key]
    else state.mailboxFailures[key] = failure
  }
  if (overrides.mailboxCreationReport) {
    state.mailboxCreationReport = {
      ...state.mailboxCreationReport,
      ...overrides.mailboxCreationReport,
    }
  }
  if (overrides.mailboxes) applyMailboxMutations(state, overrides.mailboxes)
  if (overrides.mailboxTemplates) applyMailboxTemplateMutations(state, overrides.mailboxTemplates)
}

/** Five mailboxes in `a.example` and `b.example`, for unit tests. */
export function setupMailboxesSmall(state: ScenarioState): void {
  state.domains.push(
    mockDomain({
      name: 'a.example',
      maxMailboxes: 50,
      domainQuota: 100 * GIB,
      maxMailboxQuota: 10 * GIB,
    }),
    mockDomain({
      name: 'b.example',
      maxMailboxes: 50,
      domainQuota: 100 * GIB,
      maxMailboxQuota: 10 * GIB,
    }),
  )
  state.mailboxTemplates.push(smallMailboxTemplate())
  seedMailboxes(state, [
    mockMailbox({
      localPart: 'anna',
      domain: 'a.example',
      displayName: 'Anna Smith',
      quota: 2 * GIB,
      quotaUsed: 512 * MIB,
      messageCount: 1200,
      tags: ['Sales'],
      lastLogins: {
        imap: '2026-10-17T08:00:00Z',
        pop3: null,
        smtp: '2026-10-16T09:00:00Z',
        webmailSso: null,
      },
    }),
    mockMailbox({
      localPart: 'bob',
      domain: 'a.example',
      displayName: 'Joanna Bob',
      quota: GIB,
      quotaUsed: 942 * MIB,
      messageCount: 40,
      status: 'loginDisabled',
    }),
    mockMailbox({
      localPart: 'carl',
      domain: 'a.example',
      displayName: 'Carl',
      tags: ['Annapolis'],
      status: 'inactive',
      customAttributes: { old: '1' },
    }),
    mockMailbox({
      localPart: 'dana',
      domain: 'b.example',
      displayName: 'Dana LDAP',
      authSource: 'ldap',
      quota: 5 * GIB,
      quotaUsed: GIB,
    }),
    mockMailbox({ localPart: 'eva', domain: 'b.example', displayName: 'Eva', quota: GIB }),
  ])
}

/** 10,000 mailboxes in 500 domains, generated deterministically (SC-001, SC-003). */
export function setupMailboxes10k(state: ScenarioState): void {
  for (let index = 0; index < 500; index += 1) {
    const name = `domain${String(index + 1).padStart(3, '0')}.example`
    state.domains.push(
      mockDomain({ name, maxMailboxes: 100, domainQuota: 500 * GIB, maxMailboxQuota: 20 * GIB }),
    )
    seedMailboxes(state, generateMailboxes(name, 20, index + 1))
  }
}

export const mailboxBaseScenarios: Record<string, ScenarioDefinition> = {
  'admin-mailboxes-small': {
    description: 'An administrator with five mailboxes in a.example and b.example (UI 003 units).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxesSmall,
  },
  'admin-mailboxes-10k': {
    description: 'An administrator with 10,000 mailboxes in 500 domains (UI 003 SC-001, SC-003).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxes10k,
  },
}
