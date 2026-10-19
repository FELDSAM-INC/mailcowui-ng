// Self-service state of the mock API (UI 005 T011, research R24, data-model §1). Mailbox values that
// UI 003's mailbox already stores (quota and usage, protocol access, the recovery address, tagged
// mail and TLS, the webmail preference, the password-changed time) stay on its `MockMailbox`; this
// module adds what only the self-service operations know, per mailbox (app passwords, temporary
// aliases, push notifications, recent logins, Sieve filters, the active script, the addresses of the
// overview), per account (second-factor details, other sessions, enrolments, throttles) and for the
// server (groupware, password reset, reset tokens, outages, Pushover's verdict).
import type {
  MailboxTaggedMailHandling,
  OwnSecondFactorType,
  PermissionFlags,
  RecentLogin,
  SelfServiceCapabilities,
  SieveFilterKind,
} from '@/api'

import { GIB, MIB, mockDomain } from '../../factories/domain'
import { addressOf, mockMailbox, normaliseAddress, syncDomainUsage } from '../../factories/mailbox'
import type { MockMailbox, ScenarioState } from '../state'

/** A stored app password (`app_passwd` row); the password itself is only counted. */
export interface MockAppPassword {
  id: number
  name: string
  protocols: ('imap' | 'pop3' | 'smtp' | 'sieve' | 'activeSync' | 'dav')[]
  active: boolean
  createdAt: string
  modifiedAt: string | null
  /** Bumped on every change, including a new password, so the version tag changes. */
  version: number
}

/** A stored temporary alias (`spamalias` row). `expiresAt` is epoch ms, null when permanent. */
export interface MockTemporaryAlias {
  address: string
  description: string
  expiresAt: number | null
  createdAt: string
  modifiedAt: string | null
  version: number
  /** Failure injection: every change of this alias answers this status. */
  failWith?: number
}

/** Stored Pushover settings (`pushover` row). Token and key are never returned. */
export interface MockPushSettings {
  token: string
  userKey: string
  active: boolean
  title: string
  text: string
  senders: string[]
  senderPattern: string
  sound: string
  evaluatePriority: boolean
  onlyHighPriority: boolean
  version: number
}

/** A stored Sieve filter (`sieve_filters` row). */
export interface MockSieveFilter {
  id: number
  mailbox: string
  description: string
  kind: SieveFilterKind
  script: string
  active: boolean
  createdAt: string
  modifiedAt: string | null
  version: number
  /** Failure injection for per-item runs. */
  failWith?: number
}

/** What only the self-service operations of one mailbox know. */
export interface MockMailboxSelfService {
  appPasswords: MockAppPassword[]
  temporaryAliases: MockTemporaryAlias[]
  /** Alias domains of the mailbox's domain offered for temporary aliases (ASCII). */
  temporaryAliasDomains: string[]
  push: MockPushSettings | null
  recentLogins: RecentLogin[]
  /** The script the user manages in webmail; null when none is active. */
  activeScript: { name: string; script: string } | null
  directAliases: { address: string; publicComment: string | null }[]
  sharedAliases: { address: string; publicComment: string | null }[]
  aliasDomainAddresses: { address: string; aliasDomain: string }[]
  sendAs: { addresses: string[]; domains: string[]; anyAddress: boolean }
  catchAllAddresses: string[]
  /** Version of the recovery address (its etag). */
  recoveryVersion: number
}

/** An extra second-factor entry the sign-in mock does not use (inactive or deprecated). */
export interface MockExtraSecondFactor {
  id: number
  type: OwnSecondFactorType
  name: string
  active: boolean
}

/** What the self-service operations know about one account. */
export interface MockAccountSelfService {
  /** The account's other sessions of this API, ended by a password change. */
  otherSessions: number
  /** Legacy `force_tfa`: the account must keep a second factor. */
  secondFactorRequired: boolean
  /** IDs of the account's sign-in factors that an administrator disabled. */
  inactiveFactorIds: number[]
  /** Deprecated or inactive entries besides the sign-in factors (`u2f`, `hotp`). */
  extraFactors: MockExtraSecondFactor[]
  /** The factor that completed the current sign-in. */
  signInFactorId: number | null
  /** Yubico public IDs by factor ID. */
  yubicoPublicIds: Record<number, string>
  /** The open TOTP enrolment: the base32 secret, its expiry (epoch ms) and attempts left. */
  totpEnrolment: { secret: string; expiresAt: number; attemptsLeft: number } | null
  /** The open WebAuthn options: challenge and expiry (epoch ms). */
  webauthnOptions: { challenge: string; expiresAt: number } | null
  /** Wrong current passwords since the last success (10 → 429). */
  passwordFailures: number
}

/** A password reset token (`reset_password` row). */
export interface MockResetToken {
  token: string
  username: string
  /** Epoch ms. */
  expiresAt: number
  used: boolean
}

export type SelfServiceDependency = 'sharedStore' | 'mailStore' | 'pushover' | 'addressGeneration'

export interface MockSelfServiceState {
  mailboxes: Record<string, MockMailboxSelfService>
  accounts: Record<string, MockAccountSelfService>
  groupwareEnabled: boolean
  passwordResetAvailable: boolean
  tokenLifetimeMinutes: number
  resetTokens: MockResetToken[]
  /** Reset requests and completions per address and operation (10 → 429). */
  resetAttempts: Record<string, number>
  /** Services that answer `503 temporary-failure` with their `dependency`. */
  outages: Partial<Record<SelfServiceDependency, boolean>>
  /** The Yubico service is unreachable for enrolments and resets. */
  yubicoOutage: boolean
  /** The Yubico service rejects every OTP. */
  yubicoRejects: boolean
  /** Pushover's verdict on the stored credentials. */
  pushVerification: { accepted: boolean; reason: string | null }
  /** Next IDs. */
  nextAppPasswordId: number
  nextFilterId: number
  nextFactorId: number
  /** Sieve filters of every mailbox (they carry their mailbox). */
  sieveFilters: MockSieveFilter[]
  /** Overrides of the capabilities read (merged). */
  capabilities: { bulkLimit: number; countryLookup: boolean }
}

/** Runtime changes and scenario overrides (`selfService` of `ScenarioOverrides`). */
export interface SelfServicePatch {
  mailboxes?: Record<string, Partial<MockMailboxSelfService> | null>
  accounts?: Record<string, Partial<MockAccountSelfService>>
  groupwareEnabled?: boolean
  passwordResetAvailable?: boolean
  tokenLifetimeMinutes?: number
  resetTokens?: MockResetToken[]
  outages?: Partial<Record<SelfServiceDependency, boolean>>
  yubicoOutage?: boolean
  yubicoRejects?: boolean
  pushVerification?: { accepted: boolean; reason: string | null }
  sieveFilters?: MockSieveFilter[]
  /** Changes stored filters by ID (another administrator, the classic interface). */
  setFilters?: Record<string, Partial<MockSieveFilter>>
  /** Changes stored app passwords by `<mailbox>#<id>`. */
  setAppPasswords?: Record<string, Partial<MockAppPassword>>
  /** Changes stored temporary aliases by address. */
  setTemporaryAliases?: Record<string, Partial<MockTemporaryAlias> | null>
  capabilities?: Partial<MockSelfServiceState['capabilities']>
}

export function initialSelfServiceState(): { selfService: MockSelfServiceState } {
  return {
    selfService: {
      mailboxes: {},
      accounts: {},
      groupwareEnabled: true,
      passwordResetAvailable: true,
      tokenLifetimeMinutes: 15,
      resetTokens: [],
      resetAttempts: {},
      outages: {},
      yubicoOutage: false,
      yubicoRejects: false,
      pushVerification: { accepted: true, reason: null },
      nextAppPasswordId: 100,
      nextFilterId: 100,
      nextFactorId: 100,
      sieveFilters: [],
      capabilities: { bulkLimit: 100, countryLookup: true },
    },
  }
}

export function emptyMailboxSelfService(): MockMailboxSelfService {
  return {
    appPasswords: [],
    temporaryAliases: [],
    temporaryAliasDomains: [],
    push: null,
    recentLogins: [],
    activeScript: null,
    directAliases: [],
    sharedAliases: [],
    aliasDomainAddresses: [],
    sendAs: { addresses: [], domains: [], anyAddress: false },
    catchAllAddresses: [],
    recoveryVersion: 1,
  }
}

export function emptyAccountSelfService(): MockAccountSelfService {
  return {
    otherSessions: 0,
    secondFactorRequired: false,
    inactiveFactorIds: [],
    extraFactors: [],
    signInFactorId: null,
    yubicoPublicIds: {},
    totpEnrolment: null,
    webauthnOptions: null,
    passwordFailures: 0,
  }
}

/** The self-service record of a mailbox, created empty on first use. */
export function mailboxSelfService(state: ScenarioState, address: string): MockMailboxSelfService {
  const key = normaliseAddress(address)
  return (state.selfService.mailboxes[key] ??= emptyMailboxSelfService())
}

/** The self-service record of an account, created empty on first use. */
export function accountSelfService(state: ScenarioState, username: string): MockAccountSelfService {
  const key = username.toLowerCase()
  return (state.selfService.accounts[key] ??= emptyAccountSelfService())
}

/** A stored mailbox by address, created (with its domain) when missing. */
export function ensureMailbox(
  state: ScenarioState,
  address: string,
  values: Partial<MockMailbox> = {},
): MockMailbox {
  const wanted = normaliseAddress(address)
  const [localPart = '', domain = ''] = wanted.split('@')
  if (!state.domains.some((item) => item.name === domain)) {
    state.domains.push(mockDomain({ name: domain }))
  }
  let mailbox = state.mailboxes.find((item) => addressOf(item) === wanted)
  if (!mailbox) {
    mailbox = mockMailbox({ localPart, domain, displayName: localPart, ...values })
    state.mailboxes.push(mailbox)
    syncDomainUsage(state, domain)
  } else Object.assign(mailbox, values)
  return mailbox
}

/** The flags of a mailbox user that its mailbox's user permissions grant. */
export function mailboxUserFlags(mailbox: MockMailbox): Partial<PermissionFlags> {
  const permissions = mailbox.userPermissions
  return {
    spamAlias: permissions.spamAlias,
    tlsPolicy: permissions.tlsPolicy,
    spamScore: permissions.spamScore,
    spamPolicy: permissions.spamPolicy,
    delimiterAction: permissions.delimiterAction,
    syncjobs: permissions.syncjobs,
    easReset: permissions.easReset,
    sogoProfileReset: permissions.sogoProfileReset,
    pushover: permissions.pushover,
    quarantine: permissions.quarantine,
    quarantineAttachments: permissions.quarantineAttachments,
    quarantineNotification: permissions.quarantineNotification,
    quarantineCategory: permissions.quarantineCategory,
    appPasswds: permissions.appPasswds,
    pwReset: permissions.pwReset,
  }
}

export function applySelfServiceOverrides(state: ScenarioState, patch: SelfServicePatch): void {
  const target = state.selfService
  for (const [address, change] of Object.entries(patch.mailboxes ?? {})) {
    const key = normaliseAddress(address)
    if (change === null) delete target.mailboxes[key]
    else Object.assign(mailboxSelfService(state, key), structuredClone(change))
  }
  for (const [username, change] of Object.entries(patch.accounts ?? {})) {
    Object.assign(accountSelfService(state, username), structuredClone(change))
  }
  for (const key of [
    'groupwareEnabled',
    'passwordResetAvailable',
    'tokenLifetimeMinutes',
    'yubicoOutage',
    'yubicoRejects',
  ] as const) {
    if (patch[key] !== undefined) (target[key] as unknown) = patch[key]
  }
  if (patch.resetTokens) target.resetTokens = structuredClone(patch.resetTokens)
  if (patch.outages) target.outages = { ...target.outages, ...patch.outages }
  if (patch.pushVerification) target.pushVerification = { ...patch.pushVerification }
  if (patch.sieveFilters) target.sieveFilters = structuredClone(patch.sieveFilters)
  if (patch.capabilities) target.capabilities = { ...target.capabilities, ...patch.capabilities }
  for (const [id, change] of Object.entries(patch.setFilters ?? {})) {
    const filter = target.sieveFilters.find((item) => item.id === Number(id))
    if (filter) Object.assign(filter, change, { version: filter.version + 1 })
  }
  for (const [key, change] of Object.entries(patch.setAppPasswords ?? {})) {
    const [address = '', id = ''] = key.split('#')
    const item = mailboxSelfService(state, address).appPasswords.find(
      (entry) => entry.id === Number(id),
    )
    if (item) Object.assign(item, change, { version: item.version + 1 })
  }
  for (const [address, change] of Object.entries(patch.setTemporaryAliases ?? {})) {
    for (const record of Object.values(target.mailboxes)) {
      const index = record.temporaryAliases.findIndex((item) => item.address === address)
      if (index < 0) continue
      if (change === null) record.temporaryAliases.splice(index, 1)
      else {
        const alias = record.temporaryAliases[index]!
        Object.assign(alias, change, { version: alias.version + 1 })
      }
    }
  }
}

/** The capabilities members that do not depend on the caller. */
export function capabilityValues(
  state: ScenarioState,
): Omit<SelfServiceCapabilities, 'passwordReset' | 'account'> {
  const { selfService } = state
  return {
    groupware: { enabled: selfService.groupwareEnabled, webmailUrl: '/SOGo/so/' },
    temporaryAliases: { minLifetimeHours: 1, maxLifetimeHours: 87600, defaultLifetimeHours: 8760 },
    recentLogins: {
      minDays: 1,
      maxDays: 31,
      defaultDays: 7,
      countryLookup: selfService.capabilities.countryLookup,
    },
    bulkLimit: selfService.capabilities.bulkLimit,
    pageSize: { default: 25, maximum: 1000 },
    limits: {
      nameMaxLength: 255,
      descriptionMaxLength: 255,
      sieveScriptMaxBytes: 65535,
      pushTitleMaxLength: 250,
      pushTextMaxLength: 1024,
      pushSendersMax: 100,
      pushSenderPatternMaxLength: 1024,
      pushSoundMaxLength: 20,
    },
    pushoverSounds: [
      'pushover',
      'bike',
      'bugle',
      'cashregister',
      'classical',
      'cosmic',
      'falling',
      'gamelan',
      'incoming',
      'intermission',
      'magic',
      'mechanical',
      'pianobar',
      'siren',
      'spacealarm',
      'tugboat',
      'alien',
      'climb',
      'persistent',
      'echo',
      'updown',
      'vibrate',
      'none',
    ],
    secondFactors: {
      totpIssuer: 'mailcow UI',
      totpEnrolmentLifetimeSeconds: 600,
      totpEnrolmentMaxAttempts: 5,
      webauthnOptionsLifetimeSeconds: 300,
    },
  }
}

export { GIB, MIB }
export type { MailboxTaggedMailHandling }
