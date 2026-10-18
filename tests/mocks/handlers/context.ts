// Shared helpers of the mock handlers: the typed `http` object over the generated paths, the
// per-request scenario state, problem answers and the session checks every handler repeats.
import { AsyncLocalStorage } from 'node:async_hooks'

import { HttpResponse } from 'msw'
import { createOpenApiHttp } from 'openapi-msw'

import type { PendingAction, paths, Session } from '@/api'

import { requestId } from '../factories/ids'
import { endSession, findAccount, type MockAccount, type ScenarioState } from '../scenarios/state'

/** Typed MSW handlers for the contract's paths, on any origin. */
export const http = createOpenApiHttp<paths>({ baseUrl: '*/api/v2' })

const current = new AsyncLocalStorage<ScenarioState>()

/** Runs a request's handlers with its scenario state. */
export function withScenario<T>(state: ScenarioState, callback: () => T): T {
  return current.run(state, callback)
}

/** The scenario state of the request being handled. */
export function scenario(): ScenarioState {
  const state = current.getStore()
  if (!state) throw new Error('Mock handler called outside a scenario')
  return state
}

const TITLES: Record<string, string> = {
  unauthenticated: 'Authentication required',
  'second-factor-required': 'Second factor required',
  'csrf-token-mismatch': 'CSRF token mismatch',
  'pending-action-required': 'Pending action required',
  forbidden: 'Forbidden',
  'too-many-requests': 'Too many requests',
  'validation-failed': 'Validation failed',
}

/** An `application/problem+json` answer. `type` null means `about:blank`. */
export function problem(
  status: number,
  type: string | null,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return HttpResponse.json(
    {
      type: type ? `/api/v2/problems/${type}` : 'about:blank',
      title: (type && TITLES[type]) ?? `HTTP ${status}`,
      status,
      requestId: requestId(),
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json', ...headers } },
  )
}

/** 403 csrf-token-mismatch unless the request carries the session's anti-forgery token. */
export function csrfProblem(state: ScenarioState, request: Request): Response | null {
  const sent = request.headers.get('x-csrf-token')
  if (!state.session.csrfToken || sent !== state.session.csrfToken) {
    return problem(403, 'csrf-token-mismatch')
  }
  return null
}

/** The signed-in account, keeping the session state in step with its pending actions. */
export function sessionAccount(state: ScenarioState): MockAccount | undefined {
  const { session } = state
  if (session.state !== 'active' && session.state !== 'restricted') return undefined
  const account = findAccount(state, session.username)
  if (account) session.state = account.pendingActions.length > 0 ? 'restricted' : 'active'
  return account
}

/**
 * The account of a fully or partly signed-in session, or the problem a session operation answers:
 * 401 unauthenticated, 401 second-factor-required, or 403 pending-action-required when
 * restricted sessions are not allowed.
 */
export function requireAccount(
  state: ScenarioState,
  options: { allowRestricted?: boolean } = {},
): MockAccount | Response {
  if (state.session.state === 'pendingSecondFactor') return problem(401, 'second-factor-required')
  // UI 012 (FR-052): the provider refused to renew a single sign-on session; the session is gone.
  if (state.singleSignOn.endIdpSession && state.session.authMethod === 'singleSignOn') {
    endSession(state)
    return problem(401, 'identity-provider-session-ended')
  }
  const account = sessionAccount(state)
  if (!account || !account.active) return problem(401, 'unauthenticated')
  if (state.session.state === 'restricted' && !options.allowRestricted) {
    return problem(403, 'pending-action-required', {
      pendingActions: account.pendingActions satisfies PendingAction[],
    })
  }
  return account
}

/** The recommended presentation order of second factors (`PendingSignIn.methods`). */
const SECOND_FACTOR_ORDER = { webauthn: 0, totp: 1, yubiOtp: 2 } as const

/** The contract `Session` of the scenario's session. */
export function sessionBody(state: ScenarioState): Session {
  const { session } = state
  const base: Session = { state: 'anonymous', pendingActions: [], idleTimeout: state.idleTimeout }
  if (session.state === 'pendingSecondFactor' && session.pendingSignIn) {
    const account = findAccount(state, session.pendingSignIn.username)
    if (account) {
      return {
        ...base,
        state: 'pendingSecondFactor',
        username: account.username,
        role: account.role,
        pendingSignIn: {
          methods: [...account.secondFactors]
            .sort((a, b) => SECOND_FACTOR_ORDER[a.type] - SECOND_FACTOR_ORDER[b.type])
            .map(({ secret: _secret, ...method }) => method),
          expiresAt: session.pendingSignIn.expiresAt,
        },
      }
    }
  }
  const account = sessionAccount(state)
  if (account && session.authMethod && session.signedInAt) {
    return {
      ...base,
      state: session.state,
      username: account.username,
      role: account.role,
      authMethod: session.authMethod,
      signedInAt: session.signedInAt,
      pendingActions: session.state === 'restricted' ? account.pendingActions : [],
    }
  }
  return base
}
