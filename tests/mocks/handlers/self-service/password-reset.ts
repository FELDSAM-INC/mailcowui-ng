// The password reset before sign-in (UI 005 T060, research R12): the same acknowledgement for
// every well-formed address (`password-reset-unavailable` when the operator's message is not set,
// 429 after ten requests), the token check (address, expiry, policy, methods; unknown, expired and
// used tokens are `invalid-reset-token`), the WebAuthn challenge, and the completion: the password
// rules first, then the second factor (`second-factor-required` with `methods`,
// `second-factor-failed` keeping the token valid, `second-factor-unavailable` for deprecated
// entries only, the Yubico outage), then every token of the account is invalidated and every
// session ended, this browser's too when it is signed in as that account.
import type { PasswordResetCompletionRequest, PasswordResetRequest, Writable } from '@/api'

import { passwordPolicyView, passwordViolations } from '../../factories/password-policy'
import { ownSecondFactors } from '../../factories/second-factor'
import { challengeOf, CHALLENGE_LIFETIME_MS, requestOptions } from '../../factories/webauthn'
import { accountSelfService } from '../../scenarios/self-service/state'
import {
  endSession,
  findAccount,
  type MockAccount,
  type ScenarioState,
} from '../../scenarios/state'
import { csrfProblem, http, problem, scenario } from '../context'
import { addViolation, validationFailed, type Violations } from '../domain-rules'
import { isPreHashed } from '../mailbox-rules'

const MAX_ATTEMPTS = 10
const ORDER = { webauthn: 0, totp: 1, yubiOtp: 2 } as const

// A reset challenge belongs to this browser session and this token, independently of the
// signed-in account's second-factor enrolment. Replacing the session discards its challenge.
const resetChallenges = new WeakMap<
  ScenarioState['session'],
  { token: string; challenge: string; expiresAt: number }
>()

function throttled(state: ScenarioState, key: string): Response | null {
  const attempts = (state.selfService.resetAttempts[key] ?? 0) + 1
  state.selfService.resetAttempts[key] = attempts
  if (attempts <= MAX_ATTEMPTS) return null
  const retryAfter = state.behaviour.retryAfter
  return problem(429, 'too-many-requests', { retryAfter }, { 'Retry-After': String(retryAfter) })
}

function unavailable(state: ScenarioState): Response | null {
  return state.selfService.passwordResetAvailable
    ? null
    : problem(403, 'password-reset-unavailable')
}

/** The token's account, or `400 invalid-reset-token`. */
function tokenAccount(state: ScenarioState, token: string): MockAccount | Response {
  const stored = state.selfService.resetTokens.find((item) => item.token === token)
  if (!stored || stored.used || stored.expiresAt <= state.now()) {
    return problem(400, 'invalid-reset-token')
  }
  return findAccount(state, stored.username) ?? problem(400, 'invalid-reset-token')
}

/** The usable methods of an account, in the recommended order. */
function methodsOf(account: MockAccount) {
  return [...account.secondFactors]
    .sort((a, b) => ORDER[a.type] - ORDER[b.type])
    .map(({ secret: _secret, ...method }) => method)
}

export const passwordResetHandlers = [
  http.post('/password-resets', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const off = unavailable(state)
    if (off) return response.untyped(off)
    const body = (await request.json()) as unknown as Writable<PasswordResetRequest>
    if (!/^[^\s@]+@[^\s@]+$/.test(body.address)) {
      const errors: Violations = {}
      addViolation(errors, 'address', 'invalidFormat', { format: 'email' })
      return response.untyped(validationFailed(errors))
    }
    const limit = throttled(state, `request:${body.address.toLowerCase()}`)
    if (limit) return response.untyped(limit)
    return response(200).json({
      data: { tokenLifetimeMinutes: state.selfService.tokenLifetimeMinutes },
    })
  }),

  http.post('/password-resets/token-check', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const off = unavailable(state)
    if (off) return response.untyped(off)
    const body = (await request.json()) as unknown as { token: string }
    const limit = throttled(state, 'check')
    if (limit) return response.untyped(limit)
    const account = tokenAccount(state, body.token)
    if (account instanceof Response) return response.untyped(account)
    const stored = state.selfService.resetTokens.find((item) => item.token === body.token)!
    const entries = ownSecondFactors(state, account)
    return response(200).json({
      data: {
        address: account.username,
        expiresAt: new Date(stored.expiresAt).toISOString(),
        passwordPolicy: passwordPolicyView(state.passwordPolicy),
        secondFactorRequired: entries.some((entry) => entry.active),
        secondFactorMethods: methodsOf(account),
      },
    })
  }),

  http.post('/password-resets/webauthn-challenge', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const off = unavailable(state)
    if (off) return response.untyped(off)
    const body = (await request.json()) as unknown as { token: string }
    const limit = throttled(state, 'check')
    if (limit) return response.untyped(limit)
    const account = tokenAccount(state, body.token)
    if (account instanceof Response) return response.untyped(account)
    if (!account.secondFactors.some((method) => method.type === 'webauthn')) {
      return response.untyped(problem(400, 'invalid-reset-token'))
    }
    const publicKey = requestOptions()
    const expiresAt = new Date(state.now() + CHALLENGE_LIFETIME_MS).toISOString()
    resetChallenges.set(state.session, {
      token: body.token,
      challenge: publicKey.challenge,
      expiresAt: Date.parse(expiresAt),
    })
    return response(200).json({ data: { publicKey, expiresAt } })
  }),

  http.post('/password-resets/completion', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const off = unavailable(state)
    if (off) return response.untyped(off)
    const body = (await request.json()) as unknown as Writable<PasswordResetCompletionRequest>
    const limit = throttled(state, 'complete')
    if (limit) return response.untyped(limit)
    const account = tokenAccount(state, body.token)
    if (account instanceof Response) return response.untyped(account)

    const errors: Violations = {}
    const scheme = /^\{([^}]+)\}/.exec(body.newPassword)?.[1]
    if (scheme && isPreHashed(state, body.newPassword)) {
      addViolation(errors, 'newPassword', 'preHashedPassword', { scheme: scheme.toUpperCase() })
    } else {
      for (const item of passwordViolations(state.passwordPolicy, body.newPassword)) {
        addViolation(errors, 'newPassword', item.code, item.params)
      }
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))

    const entries = ownSecondFactors(state, account)
    if (entries.some((entry) => entry.active)) {
      if (account.secondFactors.length === 0) {
        return response.untyped(problem(403, 'second-factor-unavailable'))
      }
      const factor = body.secondFactor
      if (!factor) {
        return response.untyped(
          problem(401, 'second-factor-required', { methods: methodsOf(account) }),
        )
      }
      if (factor.type === 'yubiOtp' && state.selfService.yubicoOutage) {
        return response.untyped(
          problem(503, 'temporary-verification-failure', {}, { 'Retry-After': '30' }),
        )
      }
      const challenge = resetChallenges.get(state.session)
      if (factor.type === 'webauthn') resetChallenges.delete(state.session)
      const accepted =
        factor.type === 'totp'
          ? account.secondFactors.some(
              (method) =>
                method.type === 'totp' &&
                method.id === factor.methodId &&
                method.secret === factor.code,
            )
          : factor.type === 'yubiOtp'
            ? account.secondFactors.some(
                (method) => method.type === 'yubiOtp' && method.secret === factor.otp,
              )
            : account.secondFactors.some((method) => method.type === 'webauthn') &&
              challenge !== undefined &&
              challenge.token === body.token &&
              challenge.expiresAt > state.now() &&
              challengeOf(factor.credential.response.clientDataJSON) === challenge.challenge
      if (!accepted) return response.untyped(problem(401, 'second-factor-failed'))
    }

    account.password = body.newPassword
    for (const token of state.selfService.resetTokens) {
      if (token.username.toLowerCase() === account.username.toLowerCase()) token.used = true
    }
    accountSelfService(state, account.username).otherSessions = 0
    if (state.session.username?.toLowerCase() === account.username.toLowerCase()) endSession(state)
    return response(200).json({ data: { address: account.username } })
  }),
]
