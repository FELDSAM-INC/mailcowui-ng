// Scenario state of the mock API (research R22). One state stands for one browser profile: its
// accounts and data, the public configuration, the session (state, CSRF token, last activity,
// pending sign-in and challenges), behaviour switches and failure injection by operationId.
import type {
  ApiKey,
  AuditEvent,
  Passkey,
  PendingAction,
  PermissionFlags,
  Preferences,
  PublicConfig,
  Role,
  Scope,
  SecondFactorMethod,
  SessionState,
} from '@/api'

import { type ViolationRecorder } from '../contract/validator'
import type { PublicConfigVariant } from './public-config'

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
}

export type MockAuthMethod = 'password' | 'passwordAndSecondFactor' | 'passkey'

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
}

/** A documented error answer injected for an operation, `times` times (default: always). */
export interface InjectedFailure {
  status: number
  /** Problem type name (`/api/v2/problems/<type>`); `about:blank` when omitted. */
  type?: string
  times?: number
  retryAfter?: number
  pendingActions?: PendingAction[]
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

export interface ScenarioState {
  id: string
  name: string
  accounts: MockAccount[]
  apiKeys: ApiKey[]
  auditEvents: AuditEvent[]
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
}

/** Runtime changes through `PATCH /__mock/scenarios/:id`. */
export interface ScenarioPatch extends Omit<ScenarioOverrides, 'signedInAs'> {
  /** Ends the server session now, as an idle timeout would (page.clock cannot reach the mock). */
  expireSession?: boolean
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
