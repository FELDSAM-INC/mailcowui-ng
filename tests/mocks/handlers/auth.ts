// Authentication handlers (T026, T066): the anti-forgery token, the session, password sign-in, the
// second-factor step, passkey sign-in (T085) and sign-out.
//
// Password sign-in follows the contract: one generic `sign-in-failed` for every refusal, throttling
// to 429 after the scenario threshold (without checking credentials), a deliberate delay, the
// second-factor step with the methods in the recommended order, restricted sessions for accounts
// with pending actions, and `403 second-factor-unavailable` for accounts with only U2F entries.
import type {
  PasskeySignInRequest,
  PasswordSignInRequest,
  Role,
  SecondFactorVerification,
  Writable,
} from '@/api'

import { token } from '../factories/ids'
import { challengeOf, CHALLENGE_LIFETIME_MS, requestOptions } from '../factories/webauthn'
import {
  anonymousSession,
  findAccount,
  signIn,
  type MockAccount,
  type MockAuthMethod,
  type ScenarioState,
} from '../scenarios/state'
import { csrfProblem, http, problem, scenario, sessionBody } from './context'

/** mailcow's order when no role is given: administrator, domain administrator, mailbox user. */
const ROLE_ORDER: Role[] = ['admin', 'domainAdmin', 'mailboxUser']

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A new anonymous session that keeps the anti-forgery token (sign-in steps keep it, API R7). */
export function resetToAnonymous(state: ScenarioState): void {
  state.session = { ...anonymousSession(state.now()), csrfToken: state.session.csrfToken }
}

export function throttled(state: ScenarioState): Response {
  const retryAfter = state.behaviour.retryAfter
  return problem(429, 'too-many-requests', { retryAfter }, { 'Retry-After': String(retryAfter) })
}

/** The account a password sign-in resolves to, in mailcow's order or for one role. */
function resolveAccount(
  state: ScenarioState,
  username: string,
  role: Role | undefined,
): MockAccount | undefined {
  const account = findAccount(state, username)
  if (!account) return undefined
  if (role && account.role !== role) return undefined
  return ROLE_ORDER.includes(account.role) ? account : undefined
}

/** The account owning an active passkey with this credential ID, if any. */
function passkeyOwner(state: ScenarioState, credentialId: string): MockAccount | undefined {
  return state.accounts.find((account) =>
    account.passkeys.some((passkey) => passkey.credentialId === credentialId && passkey.active),
  )
}

/**
 * UI 012 (FR-050): LDAP mailboxes sign in against the directory and Keycloak mailboxes through the
 * mailpassword flow; the session names the method. Other accounts use mailcow's own password.
 */
function passwordMethod(account: MockAccount, withSecondFactor: boolean): MockAuthMethod {
  if (account.source === 'ldap') {
    return withSecondFactor ? 'directoryPasswordAndSecondFactor' : 'directoryPassword'
  }
  if (account.source === 'keycloak') {
    return withSecondFactor ? 'providerPasswordAndSecondFactor' : 'providerPassword'
  }
  return withSecondFactor ? 'passwordAndSecondFactor' : 'password'
}

const viaProvider = (account: MockAccount | undefined) =>
  account?.source === 'ldap' || account?.source === 'keycloak'

function pendingExpired(state: ScenarioState): boolean {
  const pending = state.session.pendingSignIn
  return !pending || new Date(pending.expiresAt).getTime() <= state.now()
}

export const authHandlers = [
  http.get('/csrf-token', ({ response }) => {
    const state = scenario()
    state.session.csrfToken ??= token(48)
    return response(200).json({
      data: { token: state.session.csrfToken, headerName: 'X-CSRF-Token' },
    })
  }),

  http.get('/session', ({ response }) => {
    const state = scenario()
    if (state.session.state === 'pendingSecondFactor' && pendingExpired(state)) {
      resetToAnonymous(state)
    }
    return response(200).json({ data: sessionBody(state) })
  }),

  http.post('/session', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<PasswordSignInRequest>

    if (state.failedSignIns >= state.behaviour.throttleThreshold) {
      return response.untyped(throttled(state))
    }
    if (state.behaviour.signInDelayMs > 0) await sleep(state.behaviour.signInDelayMs)

    const username = body.username.trim().toLowerCase()
    if (username.length === 0) {
      return response.untyped(
        problem(422, 'validation-failed', {
          errors: { username: [{ code: 'required', message: 'The username is required.' }] },
        }),
      )
    }
    const account = resolveAccount(state, username, body.role)
    // UI 012 (FR-051): the provider cannot be reached; the attempt counts towards no throttling.
    if (viaProvider(account) && state.singleSignOn.providerOutage) {
      return response.untyped(
        problem(503, 'identity-provider-unavailable', {}, { 'Retry-After': '30' }),
      )
    }
    if (
      !account ||
      !account.active ||
      account.external ||
      account.source === 'genericOidc' ||
      account.password !== body.password
    ) {
      state.failedSignIns += 1
      return response.untyped(problem(401, 'sign-in-failed'))
    }
    if (account.secondFactorsUnavailable) {
      return response.untyped(problem(403, 'second-factor-unavailable'))
    }
    state.failedSignIns = 0

    if (account.secondFactors.length > 0) {
      resetToAnonymous(state)
      state.session.state = 'pendingSecondFactor'
      state.session.username = account.username
      state.session.pendingSignIn = {
        username: account.username,
        role: body.role ?? null,
        expiresAt: new Date(state.now() + CHALLENGE_LIFETIME_MS).toISOString(),
      }
    } else {
      signIn(state, account, passwordMethod(account, false))
    }
    return response(201).json(
      { data: sessionBody(state) },
      { headers: { Location: '/api/v2/session' } },
    )
  }),

  http.post('/session/passkey-challenge', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    // Single use; a new request replaces the previous challenge (two tabs take each other's).
    const challenge = {
      publicKey: requestOptions(),
      expiresAt: new Date(state.now() + CHALLENGE_LIFETIME_MS).toISOString(),
    }
    state.session.passkeyChallenge = {
      challenge: challenge.publicKey.challenge,
      expiresAt: challenge.expiresAt,
    }
    return response(200).json({ data: challenge })
  }),

  http.post('/session/passkey-assertion', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<PasskeySignInRequest>
    if (state.failedSignIns >= state.behaviour.throttleThreshold) {
      return response.untyped(throttled(state))
    }
    const challenge = state.session.passkeyChallenge
    state.session.passkeyChallenge = null
    if (
      !challenge ||
      new Date(challenge.expiresAt).getTime() <= state.now() ||
      challengeOf(body.credential.response.clientDataJSON) !== challenge.challenge
    ) {
      return response.untyped(problem(401, 'sign-in-expired'))
    }
    const account = passkeyOwner(state, body.credential.rawId)
    if (!account || !account.active || (body.role && account.role !== body.role)) {
      state.failedSignIns += 1
      return response.untyped(problem(401, 'sign-in-failed'))
    }
    signIn(state, account, 'passkey')
    return response(201).json(
      { data: sessionBody(state) },
      { headers: { Location: '/api/v2/session' } },
    )
  }),

  http.delete('/session', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    // Signing out invalidates the session and its token; the next GET /csrf-token starts anew.
    state.session = anonymousSession(state.now())
    return response(204).empty()
  }),

  http.delete('/session/pending-sign-in', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    // Idempotent: harmless when the step has already expired or was cancelled.
    if (state.session.state === 'pendingSecondFactor') resetToAnonymous(state)
    return response(204).empty()
  }),

  http.post('/session/pending-sign-in/webauthn-challenge', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    if (state.session.state !== 'pendingSecondFactor' || pendingExpired(state)) {
      resetToAnonymous(state)
      return response.untyped(problem(401, 'sign-in-expired'))
    }
    const account = findAccount(state, state.session.pendingSignIn?.username ?? null)
    if (!account?.secondFactors.some((method) => method.type === 'webauthn')) {
      return response.untyped(problem(409, null))
    }
    const challenge = {
      publicKey: requestOptions(),
      expiresAt: new Date(state.now() + CHALLENGE_LIFETIME_MS).toISOString(),
    }
    state.session.secondFactorChallenge = {
      challenge: challenge.publicKey.challenge,
      expiresAt: challenge.expiresAt,
    }
    return response(200).json({ data: challenge })
  }),

  http.post('/session/pending-sign-in/second-factor', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<SecondFactorVerification>

    if (state.session.state !== 'pendingSecondFactor' || pendingExpired(state)) {
      resetToAnonymous(state)
      return response.untyped(problem(401, 'sign-in-expired'))
    }
    const account = findAccount(state, state.session.pendingSignIn?.username ?? null)
    if (!account) {
      resetToAnonymous(state)
      return response.untyped(problem(401, 'sign-in-expired'))
    }
    const reject = () => {
      // One failed attempt cancels the pending sign-in (FR-024).
      resetToAnonymous(state)
      return response.untyped(problem(401, 'second-factor-failed'))
    }

    switch (body.type) {
      case 'totp': {
        const method = account.secondFactors.find(
          (candidate) => candidate.type === 'totp' && candidate.id === body.methodId,
        )
        if (!method || method.secret !== body.code) return reject()
        break
      }
      case 'yubiOtp': {
        if (state.behaviour.yubicoOutage) {
          // The pending sign-in stays open and the attempt does not count (FR-027).
          return response.untyped(
            problem(503, 'temporary-verification-failure', {}, { 'Retry-After': '30' }),
          )
        }
        const method = account.secondFactors.find(
          (candidate) => candidate.type === 'yubiOtp' && candidate.secret === body.otp,
        )
        if (!method) return reject()
        break
      }
      case 'webauthn': {
        const challenge = state.session.secondFactorChallenge
        state.session.secondFactorChallenge = null
        if (!challenge || new Date(challenge.expiresAt).getTime() <= state.now()) {
          resetToAnonymous(state)
          return response.untyped(problem(401, 'sign-in-expired'))
        }
        if (!account.secondFactors.some((method) => method.type === 'webauthn')) return reject()
        break
      }
    }
    signIn(state, account, passwordMethod(account, true))
    return response(200).json({ data: sessionBody(state) })
  }),
]
