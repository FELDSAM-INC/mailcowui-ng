// Mailbox factory (UI 003 T009, research R20): stored mailboxes with the legacy defaults, the
// contract `Mailbox` the handlers answer with, and a deterministic generator for large scenarios.
// Quotas are whole MiB in bytes (0 is unlimited); `percentUsed` is null for unlimited;
// `largestAllowedQuota` follows the domain's figures; the version tag hashes the stored settings and
// never the usage or the last logins; domain administrators lacking an overlapping flag do not see
// that user permission.
import { createHash } from 'node:crypto'

import type {
  Mailbox,
  MailboxProtocolAccess,
  MailboxUserPermissions,
  PermissionFlags,
  Readable,
} from '@/api'

import type { MockAccount, MockDomain, MockMailbox, ScenarioState } from '../scenarios/state'
import { asciiName, GIB, MIB, normaliseTags, readableName } from './domain'
import { mailSettingsEtag } from './mail-settings'

export { GIB, MIB }

export const ALL_PROTOCOLS: MailboxProtocolAccess = {
  imap: true,
  pop3: true,
  smtp: true,
  sieve: true,
  activeSync: true,
  dav: true,
}

/** The legacy defaults: every user permission except sync jobs and the SOGo profile reset. */
export function defaultUserPermissions(): Required<MailboxUserPermissions> {
  return {
    spamAlias: true,
    tlsPolicy: true,
    spamScore: true,
    spamPolicy: true,
    delimiterAction: true,
    syncjobs: false,
    easReset: true,
    sogoProfileReset: false,
    pushover: true,
    quarantine: true,
    quarantineAttachments: true,
    quarantineNotification: true,
    quarantineCategory: true,
    appPasswds: true,
    pwReset: true,
  }
}

/** User permissions that overlap with a domain administrator flag of the same name (FR-035). */
export const OVERLAPPING_PERMISSIONS = [
  'syncjobs',
  'quarantine',
  'appPasswds',
  'pushover',
  'spamPolicy',
] as const satisfies readonly (keyof MailboxUserPermissions & keyof PermissionFlags)[]

/** The user permissions a caller sees: all for administrators, the allowed ones otherwise. */
export function visiblePermissions(
  account: MockAccount,
  permissions: Required<MailboxUserPermissions>,
): MailboxUserPermissions {
  if (account.role === 'admin') return { ...permissions }
  const visible: Partial<MailboxUserPermissions> = { ...permissions }
  for (const flag of OVERLAPPING_PERMISSIONS) {
    if (!account.permissions[flag]) delete visible[flag]
  }
  return visible as MailboxUserPermissions
}

export const addressOf = (mailbox: Pick<MockMailbox, 'localPart' | 'domain'>) =>
  `${mailbox.localPart}@${mailbox.domain}`

/** The API's normal form of an address given in any letter case and domain form. */
export function normaliseAddress(input: string): string {
  const at = input.lastIndexOf('@')
  if (at < 0) return input.trim().toLowerCase()
  const local = input.slice(0, at).trim().toLowerCase()
  const domain =
    asciiName(input.slice(at + 1)) ||
    input
      .slice(at + 1)
      .trim()
      .toLowerCase()
  return `${local}@${domain}`
}

/** A stored mailbox with the legacy defaults, overridden. */
export function mockMailbox(
  overrides: Partial<MockMailbox> & { localPart: string; domain: string },
): MockMailbox {
  const domain = asciiName(overrides.domain) || overrides.domain
  return {
    displayName: overrides.localPart,
    status: 'active',
    authSource: 'mailcow',
    hasPassword: true,
    quota: 0,
    quotaUsed: 0,
    messageCount: 0,
    forcePasswordChange: false,
    forceSecondFactorSetup: false,
    webmailRedirect: true,
    recoveryEmail: null,
    passwordChangedAt: '2026-01-10T08:00:00.000Z',
    lastLogins: { imap: null, pop3: null, smtp: null, webmailSso: null },
    taggedMailHandling: 'none',
    tlsEnforceInbound: false,
    tlsEnforceOutbound: false,
    quarantineNotification: 'hourly',
    quarantineCategory: 'rejected',
    rateLimit: null,
    relayhostId: null,
    activeTemporaryAliases: 0,
    pushNotificationsActive: false,
    createdAt: '2026-01-05T08:00:00.000Z',
    modifiedAt: null,
    customAttributes: {},
    ...overrides,
    localPart: overrides.localPart.toLowerCase(),
    domain,
    protocolAccess: { ...ALL_PROTOCOLS, ...overrides.protocolAccess },
    userPermissions: { ...defaultUserPermissions(), ...overrides.userPermissions },
    tags: normaliseTags(overrides.tags ?? []),
  }
}

/** The stored settings that make up the version tag (FR-038): no usage, no last logins. */
const STORED_KEYS = [
  'localPart',
  'domain',
  'displayName',
  'status',
  'authSource',
  'quota',
  'forcePasswordChange',
  'forceSecondFactorSetup',
  'webmailRedirect',
  'protocolAccess',
  'userPermissions',
  'tags',
  'customAttributes',
  'recoveryEmail',
  'passwordChangedAt',
  'taggedMailHandling',
  'tlsEnforceInbound',
  'tlsEnforceOutbound',
  'quarantineNotification',
  'quarantineCategory',
  'rateLimit',
  'relayhostId',
  'modifiedAt',
] as const satisfies readonly (keyof MockMailbox)[]

/** A strong, quoted version tag of the stored settings. */
export function mailboxEtag(mailbox: MockMailbox): string {
  const stored = Object.fromEntries(STORED_KEYS.map((key) => [key, mailbox[key]]))
  return `"m${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}

/** The version tag of a mailbox's mail settings (contract `Mailbox.mailSettingsVersion`, API 005). */
export function mailSettingsVersion(mailbox: MockMailbox): string {
  const stored = [mailbox.taggedMailHandling, mailbox.tlsEnforceInbound, mailbox.tlsEnforceOutbound]
  return `"s${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}

/** The domain of a mailbox, or a placeholder for mailboxes whose domain was removed. */
export function domainOf(state: ScenarioState, mailbox: MockMailbox): MockDomain | undefined {
  return state.domains.find((domain) => domain.name === mailbox.domain)
}

/** The largest quota this mailbox may get: domain quota minus the others, capped, ≥ 0. */
export function largestAllowedQuota(state: ScenarioState, mailbox: MockMailbox): number {
  const domain = domainOf(state, mailbox)
  if (!domain) return 0
  const others = domain.usage.quotaAllocated - mailbox.quota
  return Math.max(0, Math.min(domain.maxMailboxQuota, domain.domainQuota - others))
}

/** The contract representation for a caller. */
export function mailboxView(
  state: ScenarioState,
  mailbox: MockMailbox,
  account: MockAccount,
): Readable<Mailbox> {
  const domain = domainOf(state, mailbox)
  const ownLimit = mailbox.rateLimit
  const domainLimit = domain?.rateLimit ?? null
  const reported = state.mailboxCapabilities.lastLoginsReported
  return {
    address: addressOf(mailbox),
    localPart: mailbox.localPart,
    domain: mailbox.domain,
    domainUnicode: readableName(mailbox.domain),
    displayName: mailbox.displayName,
    status: mailbox.status,
    authSource: mailbox.authSource,
    quota: mailbox.quota,
    quotaUsed: mailbox.quotaUsed,
    messageCount: mailbox.messageCount,
    percentUsed: mailbox.quota === 0 ? null : Math.round((mailbox.quotaUsed / mailbox.quota) * 100),
    largestAllowedQuota: largestAllowedQuota(state, mailbox),
    forcePasswordChange: mailbox.forcePasswordChange,
    forceSecondFactorSetup: mailbox.forceSecondFactorSetup,
    webmailRedirect: mailbox.webmailRedirect,
    protocolAccess: { ...mailbox.protocolAccess },
    userPermissions: visiblePermissions(account, mailbox.userPermissions),
    tags: [...mailbox.tags],
    customAttributes: { ...mailbox.customAttributes },
    recoveryEmail: mailbox.recoveryEmail,
    passwordChangedAt: mailbox.passwordChangedAt,
    lastLogins: reported
      ? { ...mailbox.lastLogins }
      : { imap: null, pop3: null, smtp: null, webmailSso: null },
    taggedMailHandling: mailbox.taggedMailHandling,
    tlsEnforceInbound: mailbox.tlsEnforceInbound,
    tlsEnforceOutbound: mailbox.tlsEnforceOutbound,
    mailSettingsVersion: mailSettingsEtag(mailbox),
    quarantineNotification: mailbox.quarantineNotification,
    quarantineCategory: mailbox.quarantineCategory,
    rateLimit: ownLimit ? { ...ownLimit } : domainLimit ? { ...domainLimit } : null,
    rateLimitSource: ownLimit ? 'mailbox' : domainLimit ? 'domain' : 'none',
    relayhostId: mailbox.relayhostId,
    activeTemporaryAliases: mailbox.activeTemporaryAliases,
    pushNotificationsActive: mailbox.pushNotificationsActive,
    domainRelayed: domain?.backupMx ?? false,
    createdAt: mailbox.createdAt,
    modifiedAt: mailbox.modifiedAt,
    mailSettingsVersion: mailSettingsVersion(mailbox),
    etag: mailboxEtag(mailbox),
  }
}

/** A seeded pseudo-random generator (mulberry32), so large scenarios are the same every run. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const FIRST = ['anna', 'bob', 'carl', 'dana', 'eva', 'filip', 'gabi', 'hana', 'ivan', 'jana']
const LAST = ['novak', 'svoboda', 'dvorak', 'cerny', 'prochazka', 'kucera', 'vesely', 'horak']
const STATUSES = ['active', 'active', 'active', 'active', 'loginDisabled', 'inactive'] as const

/** `count` deterministic mailboxes of `domain`, with varied usage, statuses and tags. */
export function generateMailboxes(domain: string, count: number, seed: number): MockMailbox[] {
  const random = seededRandom(seed)
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!
  return Array.from({ length: count }, (_, index) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const quota = random() < 0.15 ? 0 : (1 + Math.floor(random() * 10)) * GIB
    const quotaUsed = Math.floor(random() * (quota || 4 * GIB))
    return mockMailbox({
      localPart: `${first}.${last}${index + 1}`,
      domain,
      displayName: `${first[0]!.toUpperCase()}${first.slice(1)} ${last[0]!.toUpperCase()}${last.slice(1)}`,
      status: pick(STATUSES),
      quota,
      quotaUsed,
      messageCount: Math.floor(random() * 20_000),
      tags: random() < 0.3 ? [pick(['Sales', 'Support', 'Staff', 'Students'])] : [],
      lastLogins: {
        imap:
          random() < 0.7
            ? `2026-10-${String(1 + Math.floor(random() * 17)).padStart(2, '0')}T08:00:00Z`
            : null,
        pop3: null,
        smtp: random() < 0.5 ? '2026-10-15T10:30:00Z' : null,
        webmailSso: null,
      },
      createdAt: `2026-0${1 + Math.floor(random() * 9)}-1${Math.floor(random() * 9)}T09:00:00.000Z`,
    })
  })
}

/**
 * Keeps each domain's usage in step with its stored mailboxes: the count, the quota allocated, the
 * largest mailbox quota, the storage used and the messages.
 */
export function syncDomainUsage(state: ScenarioState, domainName: string): void {
  const domain = state.domains.find((item) => item.name === domainName)
  if (!domain) return
  const mailboxes = state.mailboxes.filter((mailbox) => mailbox.domain === domainName)
  domain.usage = {
    ...domain.usage,
    mailboxes: mailboxes.length,
    quotaAllocated: mailboxes.reduce((sum, mailbox) => sum + mailbox.quota, 0),
    largestMailboxQuota: mailboxes.reduce((max, mailbox) => Math.max(max, mailbox.quota), 0),
    storageUsed: mailboxes.reduce((sum, mailbox) => sum + mailbox.quotaUsed, 0),
    messages: mailboxes.reduce((sum, mailbox) => sum + mailbox.messageCount, 0),
  }
}

/** Stores mailboxes and brings their domains' usage in step with them. */
export function seedMailboxes(state: ScenarioState, mailboxes: MockMailbox[]): void {
  state.mailboxes.push(...mailboxes)
  for (const name of new Set(mailboxes.map((mailbox) => mailbox.domain))) {
    syncDomainUsage(state, name)
  }
}
