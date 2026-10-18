// Single sign-on handlers (UI 012 T040, research R24). The start stores a random state, its expiry
// (10 minutes) and the return address `<origin>/ng/sso/return` on the scenario's session and answers
// the fake provider's authorization address (`https://idp.example.test/auth`, routed by the
// end-to-end fixture `fakeProvider`). The completion and the provider-error report consume the
// pending state first; a missing, expired or foreign state is `401 sign-in-state-invalid`. The
// completion then answers as `singleSignOn.completion` says. Every answer follows the contract.
import { randomBytes } from 'node:crypto'

import type {
  SingleSignOnCompletionRequest,
  SingleSignOnProviderErrorRequest,
  Writable,
} from '@/api'

import { mailboxAccount } from '../scenarios/accounts'
import { findAccount, signIn, type ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario, sessionBody } from './context'

export const FAKE_PROVIDER_ORIGIN = 'https://idp.example.test'
const PENDING_LIFETIME_MS = 600_000

/** Single sign-on is offered: a complete Keycloak or generic OIDC configuration exists. */
function available(state: ScenarioState): boolean {
  return state.publicConfig.externalIdentityProvider.singleSignOnAvailable
}

/** Takes the session's pending single sign-on: true when `sent` is its state and it is current. */
function consume(state: ScenarioState, sent: string): boolean {
  const pending = state.singleSignOn.pending
  state.singleSignOn.pending = null
  return !!pending && pending.state === sent && pending.expiresAt > state.now()
}

function returnAddress(request: Request): string {
  const origin = request.headers.get('origin') ?? 'http://localhost:4173'
  return `${origin}/ng/sso/return`
}

export const singleSignOnHandlers = [
  http.post('/session/single-sign-on', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    if (!available(state) || state.singleSignOn.startNotAvailable) {
      return response.untyped(problem(409, 'single-sign-on-not-available'))
    }
    const value = randomBytes(24).toString('base64url')
    const returnUrl = returnAddress(request)
    const expiresAt = state.now() + PENDING_LIFETIME_MS
    state.singleSignOn.pending = { state: value, expiresAt, returnUrl }
    const url = new URL(`${FAKE_PROVIDER_ORIGIN}/auth`)
    url.searchParams.set('client_id', 'mailcow')
    url.searchParams.set('redirect_uri', returnUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid profile email')
    url.searchParams.set('state', value)
    url.searchParams.set('code_challenge', randomBytes(32).toString('base64url'))
    url.searchParams.set('code_challenge_method', 'S256')
    return response(200).json({
      data: { authorizationUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() },
    })
  }),

  http.delete('/session/single-sign-on', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    state.singleSignOn.pending = null
    return response(204).empty()
  }),

  http.post('/session/single-sign-on/completion', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<SingleSignOnCompletionRequest>
    if (!consume(state, body.state)) {
      return response.untyped(problem(401, 'sign-in-state-invalid'))
    }
    const sso = state.singleSignOn
    switch (sso.completion) {
      case 'stateInvalid':
        return response.untyped(problem(401, 'sign-in-state-invalid'))
      case 'refused':
        return response.untyped(problem(401, 'sign-in-failed'))
      case 'unavailable':
        return response.untyped(
          problem(503, 'identity-provider-unavailable', {}, { 'Retry-After': '30' }),
        )
      case 'notAvailable':
        return response.untyped(problem(409, 'single-sign-on-not-available'))
      case 'success':
        break
    }
    let account = findAccount(state, sso.username)
    if (!account) {
      // Automatic creation at the first sign-in (FR-047): a mailbox from the mapped template.
      account = mailboxAccount({ username: sso.username, source: sso.provider })
      state.accounts.push(account)
    }
    signIn(state, account, 'singleSignOn')
    // Forced password change and second-factor setup never restrict a single sign-on session.
    state.session.state = 'active'
    return response(201).json(
      { data: sessionBody(state) },
      { headers: { Location: '/api/v2/session' } },
    )
  }),

  http.post('/session/single-sign-on/provider-error', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<SingleSignOnProviderErrorRequest>
    if (!consume(state, body.state)) {
      return response.untyped(problem(401, 'sign-in-state-invalid'))
    }
    return response(204).empty()
  }),
]
