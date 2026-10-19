// Scenario state of the mock API (research R22). One state stands for one browser profile: its
// accounts and data, the public configuration, the session (state, CSRF token, last activity,
// pending sign-in and challenges), behaviour switches and failure injection by operationId.
import type {
  AliasCapabilities,
  AliasDestinationType,
  AliasDomainCreationReport,
  AliasDomainRateLimit,
  ApiKey,
  AuditEvent,
  DkimDnsPublicationOutcome,
  DnsCapabilities,
  DnsCheck,
  DnsCheckMessage,
  DomainCapabilities,
  DomainCreationReport,
  DomainDkimCapabilities,
  DomainRateLimit,
  DomainRelayhost,
  MailboxAuthSource,
  MailboxCapabilities,
  MailboxCreationReport,
  MailboxDeletionPreview,
  MailboxLastLogins,
  MailboxProtocolAccess,
  MailboxQuarantineCategory,
  MailboxQuarantineNotification,
  MailboxRateLimit,
  MailboxRenameStep,
  MailboxStatus,
  MailboxTaggedMailHandling,
  MailboxUserPermissions,
  IdentityProviderType,
  MtaStsMode,
  Oauth2ClientCapabilities,
  Passkey,
  PasswordPolicy,
  PendingAction,
  PermissionFlags,
  Preferences,
  PublicConfig,
  ResourceBookingRule,
  ResourceKind,
  Role,
  Scope,
  SecondFactorMethod,
  SessionState,
} from '@/api'

import { type ViolationRecorder } from '../contract/validator'
import type { MockIdentityProvider } from '../factories/identity-provider'
import type { MockOauth2Client } from '../factories/oauth2-client'
import type { PublicConfigVariant } from './public-config'
import type { SyncJobChanges, SyncJobState } from './sync-jobs'
import type { MockRoutingState, RoutingOverrides } from './routing/state'

/** A second-factor method with the value the mock accepts for it. */
export interface MockSecondFactor extends SecondFactorMethod {
  /** TOTP code or Yubico OTP the mock accepts; WebAuthn methods accept any credential of the account. */
  secret: string
}

/** A passkey with the credential ID (base64url `rawId`) the mock recognises in assertions. */
export interface MockPasskey extends Passkey {
  credentialId: string
}

export interface MockAccount {
  username: string
  password: string
  role: Role
  active: boolean
  /** Signs in through an external identity provider: the password never works here (FR-008). */
  external: boolean
  secondFactors: MockSecondFactor[]
  /** Only deprecated U2F entries: password sign-in answers second-factor-unavailable (FR-028). */
  secondFactorsUnavailable: boolean
  passkeys: MockPasskey[]
  permissions: PermissionFlags
  scope: Scope
  pendingActions: PendingAction[]
  preferences: Preferences
  /**
   * UI 012: the authentication source (`mailbox.authsource`); `mailcow` when absent. LDAP and
   * Keycloak mailboxes sign in with their password through the provider.
   */
  source?: 'mailcow' | IdentityProviderType
}

export type MockAuthMethod =
  | 'password'
  | 'passwordAndSecondFactor'
  | 'passkey'
  // UI 012: sign-ins through the identity provider.
  | 'singleSignOn'
  | 'directoryPassword'
  | 'directoryPasswordAndSecondFactor'
  | 'providerPassword'
  | 'providerPasswordAndSecondFactor'

/** UI 012: single sign-on of the mock (research R24). */
export interface MockSingleSignOn {
  /** The session's pending single sign-on: its state, expiry (epoch ms) and return address. */
  pending: { state: string; expiresAt: number; returnUrl: string } | null
  /** How a completion with the pending state is answered. */
  completion: 'success' | 'stateInvalid' | 'refused' | 'unavailable' | 'notAvailable'
  /** The mailbox a successful completion signs in. */
  username: string
  /** The provider of a successful completion. */
  provider: IdentityProviderType
  /** The start is answered `409 single-sign-on-not-available` even when available. */
  startNotAvailable: boolean
  /** Every authenticated request answers `401 identity-provider-session-ended`. */
  endIdpSession: boolean
  /** The password sign-in of provider accounts answers `503 identity-provider-unavailable`. */
  providerOutage: boolean
  /** Counter of issued codes and states. */
  counter: number
}

export interface MockChallenge {
  challenge: string
  expiresAt: string
}

export interface MockSession {
  state: SessionState
  username: string | null
  authMethod: MockAuthMethod | null
  signedInAt: string | null
  /** The anonymous session's anti-forgery token; null until GET /csrf-token creates the session. */
  csrfToken: string | null
  /** Epoch ms of the last request that renewed the server's idle timer. */
  lastActivityAt: number
  pendingSignIn: { username: string; role: Role | null; expiresAt: string } | null
  passkeyChallenge: MockChallenge | null
  secondFactorChallenge: MockChallenge | null
  registrationChallenge: MockChallenge | null
}

export interface Behaviour {
  /** Failed sign-ins before the mock answers 429 (the API: 10 within 15 minutes). */
  throttleThreshold: number
  /** `retryAfter` seconds of a throttled answer. */
  retryAfter: number
  /** Milliseconds a sign-in answer is deliberately delayed (FR-017). */
  signInDelayMs: number
  /** The Yubico verification service is unreachable (FR-027). */
  yubicoOutage: boolean
  /** The installation's `/lang/` files cannot be loaded: the app uses its bundled snapshot. */
  langUnavailable: boolean
  /**
   * The installation's own wording, by language code and section, merged over the served files:
   * a fork's or an operator's texts, or markup (`{ 'en-gb': { login: { login: '…' } } }`).
   */
  langPatch: Record<string, Record<string, Record<string, string>>>
}

/** A documented error answer injected for an operation, `times` times (default: always). */
export interface InjectedFailure {
  status: number
  /** Problem type name (`/api/v2/problems/<type>`); `about:blank` when omitted. */
  type?: string
  times?: number
  retryAfter?: number
  pendingActions?: PendingAction[]
  /** Field violations of an injected `422 validation-failed`. */
  errors?: Record<string, { code: string; message: string; params?: Record<string, unknown> }[]>
}

export interface RecordedRequest {
  at: number
  method: string
  path: string
  operationId: string | null
  status: number
  /** Request body with password, code, otp, credential and secret fields redacted. */
  body?: unknown
  headers: Record<string, string>
}

/** Usage inputs of a mock domain; the derived figures (left, new mailbox quotas) are computed. */
export interface MockDomainUsage {
  mailboxes: number
  resources: number
  aliases: number
  largestMailboxQuota: number
  quotaAllocated: number
  storageUsed: number
  messages: number
}

/** A stored domain of the mock (UI 002 research D28). Quotas are bytes in whole MiB. */
export interface MockDomain {
  /** Lower-case ASCII name. */
  name: string
  description: string
  active: boolean
  maxMailboxes: number
  maxAliases: number
  maxMailboxQuota: number
  domainQuota: number
  backupMx: boolean
  relayAllRecipients: boolean
  relayUnknownOnly: boolean
  globalAddressList: boolean
  tags: string[]
  relayhost: DomainRelayhost | null
  rateLimit: DomainRateLimit | null
  createdAt: string
  modifiedAt: string | null
  usage: MockDomainUsage
  /** Addresses for previews and footer checks; generated from the usage counts when absent. */
  mailboxAddresses?: string[]
  resourceAddresses?: string[]
  aliasAddresses?: string[]
}

/** A stored domain template of the mock. */
export interface MockDomainTemplate {
  id: number
  name: string
  tags: string[]
  maxMailboxes: number
  maxAliases: number
  maxMailboxQuota: number
  domainQuota: number
  rateLimit: DomainRateLimit | null
  active: boolean
  globalAddressList: boolean
  backupMx: boolean
  relayAllRecipients: boolean
  relayUnknownOnly: boolean
  dkimSelector: string
  dkimKeySize: number
  createdAt: string
  modifiedAt: string | null
}

/** A stored domain footer of the mock. */
export interface MockFooter {
  html: string
  plain: string
  skipReplies: boolean
  excludedAddresses: string[]
  excludedAliasDomains: string[]
}

/** A failure injected for one domain: its writes, or only the listed operations, answer it. */
export interface DomainFailure {
  status: number
  /** Problem type name; `about:blank` when omitted. */
  type?: string
  operations?: string[]
  retryAfter?: number
  times?: number
}

/** Runtime changes to the domain data, standing in for another administrator (research D28). */
export interface DomainMutations {
  /** Changes stored values by ASCII name; `usage` is merged. */
  set?: Record<string, Partial<MockDomain>>
  add?: (Partial<MockDomain> & { name: string })[]
  remove?: string[]
  /** Adds one mailbox to each named domain. */
  addMailbox?: string[]
}

export interface TemplateMutations {
  set?: Record<string, Partial<MockDomainTemplate>>
  add?: (Partial<MockDomainTemplate> & { name: string })[]
  remove?: number[]
}

export interface FooterMutations {
  set?: Record<string, Partial<MockFooter>>
  remove?: string[]
}

/**
 * A stored mailbox of the mock (UI 003 research R20). Quotas and usage are bytes; the address is
 * `localPart@domain` with the domain in ASCII. Usage and last logins are not part of the version
 * tag. The deletion preview's dependent records are seeded per mailbox.
 */
export interface MockMailbox {
  localPart: string
  domain: string
  displayName: string
  status: MailboxStatus
  authSource: MailboxAuthSource
  /** Whether a password hash is stored (switching back to `mailcow` needs one). */
  hasPassword: boolean
  quota: number
  quotaUsed: number
  messageCount: number
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
  protocolAccess: MailboxProtocolAccess
  /** All fifteen permissions; domain administrators see the ones their flags allow. */
  userPermissions: Required<MailboxUserPermissions>
  tags: string[]
  customAttributes: Record<string, string>
  recoveryEmail: string | null
  passwordChangedAt: string | null
  lastLogins: MailboxLastLogins
  taggedMailHandling: MailboxTaggedMailHandling
  tlsEnforceInbound: boolean
  tlsEnforceOutbound: boolean
  quarantineNotification: MailboxQuarantineNotification
  quarantineCategory: MailboxQuarantineCategory
  /** The mailbox's own rate limit; the domain's applies when null. */
  rateLimit: MailboxRateLimit | null
  relayhostId: number | null
  activeTemporaryAliases: number
  pushNotificationsActive: boolean
  createdAt: string
  modifiedAt: string | null
  /** Records a deletion would remove (deletion preview counts); missing counts are 0. */
  dependents?: Partial<MailboxDeletionPreview['counts']>
  exclusiveAliases?: string[]
  sharedAliases?: string[]
  present?: Partial<MailboxDeletionPreview['present']>
}

/** A stored mailbox template of the mock. */
export interface MockMailboxTemplate {
  id: number
  name: string
  quota: number
  status: MailboxStatus
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
  webmailRedirect: boolean
  protocolAccess: MailboxProtocolAccess
  userPermissions: Required<MailboxUserPermissions>
  tags: string[]
  taggedMailHandling: MailboxTaggedMailHandling
  quarantineNotification: MailboxQuarantineNotification
  quarantineCategory: MailboxQuarantineCategory
  tlsEnforceInbound: boolean
  tlsEnforceOutbound: boolean
  rateLimit: MailboxRateLimit | null
  createdAt: string
  modifiedAt: string | null
}

/**
 * A stored alias domain (UI 004 research R21). UI 002 stores only the name and the target; the
 * other members default to active, no rate limit, a fixed creation time and never modified.
 */
export interface MockAliasDomain {
  /** Lower-case ASCII name. */
  name: string
  target: string
  active?: boolean
  rateLimit?: AliasDomainRateLimit | null
  createdAt?: string
  modifiedAt?: string | null
}

/**
 * A stored alias (UI 004): the `alias` row. `address` has the local part as given and the domain
 * part in lower-case ASCII (`@domain` for a catch-all); the domain, kind, primary domain and
 * orphaned state are derived from it and the stored domains.
 */
export interface MockAlias {
  id: number
  address: string
  destinationType: AliasDestinationType
  /** As stored, for `addresses`; empty for a special action. */
  destinations: string[]
  active: boolean
  senderAllowed: boolean
  groupwareVisible: boolean
  internal: boolean
  publicComment: string
  privateComment: string
  createdAt: string
  modifiedAt: string | null
}

/**
 * A failure injected for one mailbox (by address) or one template (by `template:<id>`): its
 * writes, or only the listed operations, answer it. `extra` holds the problem's extension members
 * (`dependency`, `step`, `steps`, …).
 */
export interface MailboxFailure {
  status: number
  /** Problem type name; `about:blank` when omitted. */
  type?: string
  operations?: string[]
  retryAfter?: number
  times?: number
  extra?: Record<string, unknown> & { steps?: MailboxRenameStep[] }
}

/** Runtime changes to the mailboxes, standing in for another administrator (UI 003 R20). */
export interface MailboxMutations {
  /** Changes stored values by address; every stored change also changes the version tag. */
  set?: Record<string, Partial<MockMailbox>>
  add?: (Partial<MockMailbox> & { localPart: string; domain: string })[]
  remove?: string[]
}

export interface MailboxTemplateMutations {
  set?: Record<string, Partial<MockMailboxTemplate>>
  add?: (Partial<MockMailboxTemplate> & { name: string })[]
  remove?: number[]
}

/** A stored groupware resource (UI 004): a `mailbox` row of a resource kind. */
export interface MockResource {
  /** Derived local part, its letter case kept, `@` and the ASCII domain. */
  address: string
  description: string
  kind: ResourceKind
  bookingRule: ResourceBookingRule
  /** Only with `limited`. */
  bookingLimit: number | null
  active: boolean
  createdAt: string
  modifiedAt: string | null
}

/** A `sender_acl` row (UI 004): an explicit permission or, with `external`, an external address. */
export interface MockSenderAcl {
  mailbox: string
  /** An address, `@domain` or `*`. */
  sendAs: string
  external: boolean
}

type ReportStep = keyof Omit<AliasDomainCreationReport, 'messages'>

/** Outcomes of the alias domain creation report that override the computed ones (UI 004). */
export type AliasDomainCreationOutcomes = Partial<{
  [K in ReportStep]: AliasDomainCreationReport[K]
}>

/**
 * Changes behind the app's back (UI 004 `changeElsewhere`), standing in for another administrator
 * or the classic interface: stored values change, and with them the version tag and `modifiedAt`.
 * Aliases are named by ID (as a string) or address, alias domains by name, resources by address and
 * sender settings by mailbox.
 */
export interface ChangesElsewhere {
  alias?: Record<string, Partial<Omit<MockAlias, 'id'>>>
  aliasDomain?: Record<string, Partial<Omit<MockAliasDomain, 'name'>>>
  resource?: Record<string, Partial<Omit<MockResource, 'address'>>>
  senderSettings?: Record<string, { explicit?: string[]; external?: string[] }>
}

/** Objects deleted behind the app's back (UI 004 `deleteElsewhere`). */
export interface DeletionsElsewhere {
  alias?: (number | string)[]
  aliasDomain?: string[]
  resource?: string[]
}

/**
 * A stored DKIM key of the mock (UI 010 research R24). Missing parts are null (an incomplete key);
 * the private key is never returned except by the export.
 */
export interface MockDkimKey {
  /** null for an incomplete key without selector */
  selector: string | null
  /** RSA size of the stored key; null when no public key */
  keyLength: number | null
  /** base64 DER SPKI; null when missing */
  publicKey: string | null
  /** PEM; null when missing. Never returned except by exportDkimPrivateKey */
  privateKeyPem: string | null
  /** Bumps on every change; the version tag hashes the name, the key parts and this. */
  version: number
}

/** A stored MTA-STS policy of the mock. */
export interface MockMtaStsPolicy {
  mode: MtaStsMode
  mxHosts: string[]
  maxAge: number
  active: boolean
  policyId: string
  version: number
}

/** The checks and notes one diagnostics run of a name answers (UI 010 T052). */
export interface DiagnosticsTemplate {
  checks: DnsCheck[]
  notes?: DnsCheckMessage[]
  /** The server's public IPv6 address for this run; null for a server without one. */
  publicIpv6?: string | null
  /** The server's public IPv4 address; null when it could not be determined. */
  publicIpv4?: string | null
}

/** UI 010: DKIM keys, the DNS capabilities, MTA-STS policies, diagnostics and injections. */
export interface MockDnsState {
  /** By stored name: lower-case ASCII for domains and alias domains; an unused key keeps its stored spelling. */
  keys: Record<string, MockDkimKey>
  capabilities: Omit<DnsCapabilities, 'serverHostname'>
  /** By ASCII domain. */
  policies: Record<string, MockMtaStsPolicy>
  /** By ASCII name; names without one get a default template. */
  diagnostics: Record<string, DiagnosticsTemplate>
  /** One caller per scenario: `limit` runs per 60 s window of `now()`. */
  rateLimit: { limit: number; remaining: number; windowStartedAt: number }
  /** Injected publication outcome per operationId. */
  publication: Partial<Record<string, DkimDnsPublicationOutcome>>
  /** Bulk deletion targets that fail with a temporary failure. */
  failingBulkTargets?: string[]
  /** The last policy identifier handed out, so that the next is always greater. */
  lastPolicyId?: string
}

/** Runtime changes to the DNS data (`PATCH /__mock/scenarios/:id` `{ dns: … }`). */
export interface DnsPatch {
  capabilities?: {
    dkim?: Partial<DnsCapabilities['dkim']>
    mtaSts?: Partial<DnsCapabilities['mtaSts']>
    dnsDiagnostics?: Partial<DnsCapabilities['dnsDiagnostics']>
    defaultPageSize?: number
    maxPageSize?: number
  }
  /**
   * Sets keys by name (merged into an existing key, or created: a new key without values gets a
   * generated 2048-bit key, or `generate` bits, with selector `dkim`), or removes them (null).
   */
  keys?: Record<string, (Partial<MockDkimKey> & { generate?: number }) | null>
  /** Sets policies by domain (a change of mode, MX hosts or max age gives a new identifier) or removes them. */
  policies?: Record<string, Partial<Omit<MockMtaStsPolicy, 'policyId' | 'version'>> | null>
  diagnostics?: Record<string, DiagnosticsTemplate | null>
  rateLimit?: { remaining?: number; limit?: number }
  publication?: Record<string, DkimDnsPublicationOutcome | null>
  failingBulkTargets?: string[]
}

export interface ScenarioState {
  id: string
  name: string
  accounts: MockAccount[]
  apiKeys: ApiKey[]
  auditEvents: AuditEvent[]
  /** Domains, alias domains, templates, footers and DKIM keys (UI 002). */
  domains: MockDomain[]
  aliasDomains: MockAliasDomain[]
  domainTemplates: MockDomainTemplate[]
  footers: Record<string, MockFooter>
  dkimKeys: string[]
  /** The full capabilities; `dkim` is sent to administrators only. */
  domainCapabilities: DomainCapabilities
  /** The server's own host name, which no domain may take (`reserved`). */
  serverHostname: string
  /** Outcomes of the creation report steps that override the computed ones. */
  creationReport: Partial<Omit<DomainCreationReport, 'messages'>>
  domainFailures: Record<string, DomainFailure>
  /** Milliseconds an operation's answer is delayed, by operationId. */
  delays: Record<string, number>
  /** UI 003: mailboxes, mailbox templates, the password policy and the mailbox capabilities. */
  mailboxes: MockMailbox[]
  mailboxTemplates: MockMailboxTemplate[]
  passwordPolicy: Omit<PasswordPolicy, 'etag'>
  mailboxCapabilities: MailboxCapabilities
  mailboxFailures: Record<string, MailboxFailure>
  /** Outcomes of the creation report steps that override the computed ones. */
  mailboxCreationReport: Partial<Omit<MailboxCreationReport, 'messages'>>
  /** UI 008: sync jobs, their capabilities and injected bulk failures. */
  syncJobs: SyncJobState
  /** UI 004: aliases, resources, sender permissions and temporary aliases (research R21). */
  aliases: MockAlias[]
  /** The highest alias ID handed out, so that IDs are never reused. */
  lastAliasId: number
  resources: MockResource[]
  senderAcl: MockSenderAcl[]
  temporaryAliasAddresses: string[]
  /** The full capabilities of `getAliasesCapabilities`; the handler adjusts them per role. */
  capabilities004: AliasCapabilities
  aliasDomainCreationOutcomes: AliasDomainCreationOutcomes
  /** mailcow's shared store is down: alias domain reads and writes answer 503. */
  sharedStoreDown: boolean
  /** UI 010: DKIM keys, DNS capabilities, MTA-STS policies and diagnostics. */
  dns: MockDnsState
  /** UI 009: relayhosts, transports, maps, forwarding hosts, DNS and connection test scripts. */
  routing: MockRoutingState
  publicConfig: PublicConfig
  idleTimeout: number
  session: MockSession
  behaviour: Behaviour
  failedSignIns: number
  failures: Record<string, InjectedFailure>
  requests: RecordedRequest[]
  violations: ViolationRecorder
  /** Clock of the mock, in epoch ms. */
  now: () => number
  /** UI 012: the identity provider configuration, single sign-on, OAuth2 clients and templates. */
  identityProvider: MockIdentityProvider
  singleSignOn: MockSingleSignOn
  oauth2Clients: MockOauth2Client[]
  oauth2Capabilities: Oauth2ClientCapabilities
}

/** JSON overrides for a scenario, given by tests through `POST /__mock/scenarios`. */
export interface ScenarioOverrides {
  publicConfig?: PublicConfigVariant | Partial<PublicConfig>
  idleTimeout?: number
  /** Signs the session in as this account (active, or restricted when it has pending actions). */
  signedInAs?: string
  session?: Partial<MockSession>
  behaviour?: Partial<Behaviour>
  failures?: Record<string, InjectedFailure>
  /** Changes to accounts by username; unknown usernames add a new account of the given role. */
  accounts?: Record<string, Partial<MockAccount>>
  apiKeys?: ApiKey[]
  auditEvents?: AuditEvent[]
  /** UI 002: domain data and switches (research D28). */
  domains?: DomainMutations
  templates?: TemplateMutations
  footers?: FooterMutations
  aliasDomains?: MockAliasDomain[]
  dkimKeys?: string[]
  capabilities?: Partial<Omit<DomainCapabilities, 'dkim'>> & {
    dkim?: Partial<DomainDkimCapabilities>
  }
  creationReport?: Partial<Omit<DomainCreationReport, 'messages'>>
  domainFailures?: Record<string, DomainFailure>
  delays?: Record<string, number>
  /** Domain administrator assignments by username (`assignDomains`). */
  domainAssignments?: Record<string, string[]>
  /** UI 003: mailbox data and switches (research R20). */
  mailboxes?: MailboxMutations
  mailboxTemplates?: MailboxTemplateMutations
  passwordPolicy?: Partial<Omit<PasswordPolicy, 'etag'>>
  mailboxCapabilities?: Partial<MailboxCapabilities>
  mailboxFailures?: Record<string, MailboxFailure | null>
  mailboxCreationReport?: Partial<Omit<MailboxCreationReport, 'messages'>>
  /** UI 008: sync job data and runtime changes (data-model §8). */
  syncJobs?: SyncJobChanges
  /** UI 012: merged into the identity provider state (`stored` replaces the configuration). */
  identityProvider?: Partial<MockIdentityProvider>
  singleSignOn?: Partial<MockSingleSignOn>
  /** Replaces the OAuth2 clients. */
  oauth2Clients?: MockOauth2Client[]
  oauth2Capabilities?: Partial<Oauth2ClientCapabilities>
  /** UI 004: data and switches (research R21). */
  aliases?: MockAlias[]
  resources?: MockResource[]
  senderAcl?: MockSenderAcl[]
  temporaryAliasAddresses?: string[]
  capabilities004?: Partial<AliasCapabilities>
  aliasDomainCreationOutcomes?: AliasDomainCreationOutcomes
  sharedStoreDown?: boolean
  /** Permission flags of accounts, merged by username. */
  flags?: Record<string, Partial<PermissionFlags>>
  /** UI 010: DNS data and injections. */
  dns?: DnsPatch
  /** UI 009: routing data and switches (research R23). */
  routing?: RoutingOverrides
}

/** Runtime changes through `PATCH /__mock/scenarios/:id`. */
export interface ScenarioPatch extends Omit<ScenarioOverrides, 'signedInAs'> {
  /** Ends the server session now, as an idle timeout would (page.clock cannot reach the mock). */
  expireSession?: boolean
  /** UI 004: stored values changed behind the app's back. */
  changeElsewhere?: ChangesElsewhere
  /** UI 004: objects deleted behind the app's back. */
  deleteElsewhere?: DeletionsElsewhere
}

export const DEFAULT_IDLE_TIMEOUT = 10_800

export function anonymousSession(now: number): MockSession {
  return {
    state: 'anonymous',
    username: null,
    authMethod: null,
    signedInAt: null,
    csrfToken: null,
    lastActivityAt: now,
    pendingSignIn: null,
    passkeyChallenge: null,
    secondFactorChallenge: null,
    registrationChallenge: null,
  }
}

export const defaultBehaviour = (): Behaviour => ({
  throttleThreshold: 10,
  retryAfter: 120,
  signInDelayMs: 0,
  yubicoOutage: false,
  langUnavailable: false,
  langPatch: {},
})

export function findAccount(
  state: ScenarioState,
  username: string | null,
): MockAccount | undefined {
  if (!username) return undefined
  const wanted = username.trim().toLowerCase()
  return state.accounts.find((account) => account.username.toLowerCase() === wanted)
}

/** Ends the session as the server does after the idle lifetime: a new anonymous session. */
export function endSession(state: ScenarioState): void {
  state.session = anonymousSession(state.now())
}

/** Applies the server idle timeout: a request after `idleTimeout` seconds of inactivity sees the session as ended. */
export function applyIdleTimeout(state: ScenarioState): void {
  const { session } = state
  if (session.state === 'anonymous') return
  if (state.now() - session.lastActivityAt > state.idleTimeout * 1000) endSession(state)
}

/** Signs the session in as an account, as a completed sign-in would. */
export function signIn(
  state: ScenarioState,
  account: MockAccount,
  authMethod: MockAuthMethod,
): void {
  const now = state.now()
  state.session = {
    ...anonymousSession(now),
    csrfToken: state.session.csrfToken,
    state: account.pendingActions.length > 0 ? 'restricted' : 'active',
    username: account.username,
    authMethod,
    signedInAt: new Date(now).toISOString(),
  }
}
