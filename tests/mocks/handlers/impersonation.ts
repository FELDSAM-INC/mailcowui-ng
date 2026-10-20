import type { Identity } from '@/api'
import { token, ulid } from '../factories/ids'
import { findAccount, type ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario, sessionAccount } from './context'
import { identityBody } from './identity'

export function actingValidityProblem(state: ScenarioState, path: string): Response | null {
  // Public branding never starts a session; return/sign-out complete normally even after expiry.
  if (path.startsWith('/public-config') || path === '/health' || path === '/openapi.yaml')
    return null
  const acting = state.session.impersonation
  if (!acting) return null
  const owner = findAccount(state, acting.impersonator.username)
  if (!owner?.active) {
    state.session.impersonation = undefined
    state.session.state = 'anonymous'
    state.session.username = null
    return problem(401, 'unauthenticated')
  }
  const target = findAccount(state, acting.target.username)
  const domain = target?.scope.type === 'mailbox' ? target.scope.domain : null
  const allowed =
    owner.role === 'admin' ||
    (owner.permissions.loginAs &&
      owner.scope.type === 'domains' &&
      !!domain &&
      owner.scope.domains.includes(domain))
  if (state.invalidateImpersonation || !target || !allowed) {
    state.invalidateImpersonation = false
    state.session.impersonation = undefined
    state.session.csrfToken = token(64)
    state.session.state = owner.pendingActions.length ? 'restricted' : 'active'
    return problem(403, 'impersonation-ended')
  }
  return null
}

export const impersonationHandlers = [
  http.get('/session/impersonation', ({ response }) => {
    const state = scenario(),
      account = requireAccount(state, { allowRestricted: true })
    if (account instanceof Response) return response.untyped(account)
    return state.session.impersonation
      ? response(200).json({ data: state.session.impersonation })
      : response.untyped(problem(404, null))
  }),
  http.post('/session/impersonation', async ({ request, response }) => {
    const state = scenario(),
      refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const owner = requireAccount(state)
    if (owner instanceof Response) return response.untyped(owner)
    if (state.session.impersonation) return response.untyped(problem(409, 'already-impersonating'))
    if (owner.role === 'mailboxUser') return response.untyped(problem(403, 'forbidden'))
    if (owner.role === 'domainAdmin' && !owner.permissions.loginAs)
      return response.untyped(
        problem(403, 'permission-flag-required', { requiredFlags: ['loginAs'] }),
      )
    const body = await request.json()
    if (owner.role === 'domainAdmin' && body.role === 'domainAdmin')
      return response.untyped(problem(403, 'forbidden'))
    const target = findAccount(state, body.username)
    const domain = target?.scope.type === 'mailbox' ? target.scope.domain : null
    if (
      !target ||
      target.role !== body.role ||
      (owner.role === 'domainAdmin' &&
        (target.role !== 'mailboxUser' ||
          owner.scope.type !== 'domains' ||
          !domain ||
          !owner.scope.domains.includes(domain)))
    )
      return response.untyped(problem(404, null))
    state.session.impersonation = {
      id: ulid(),
      startedAt: new Date(state.now()).toISOString(),
      impersonator: {
        username: owner.username,
        role: owner.role,
        authMethod: state.session.authMethod ?? 'password',
      },
      target: { username: target.username, role: body.role },
    }
    state.session.csrfToken = token(64)
    const identity: Identity = identityBody(state, sessionAccount(state)!)
    return response(201).json(
      {
        data: {
          ...state.session.impersonation,
          identity,
          csrfToken: { token: state.session.csrfToken, headerName: 'X-CSRF-Token' },
        },
      },
      { headers: { Location: '/api/v2/session/impersonation' } },
    )
  }),
  http.delete('/session/impersonation', ({ request, response }) => {
    const state = scenario(),
      refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state, { allowRestricted: true })
    if (account instanceof Response) return response.untyped(account)
    state.session.impersonation = undefined
    state.session.csrfToken = token(64)
    sessionAccount(state)
    return response(204).empty()
  }),
]
