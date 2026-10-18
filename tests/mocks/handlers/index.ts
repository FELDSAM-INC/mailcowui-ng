// Mock API handlers (research R22), shared by every transport: Vitest (msw/node), the Node mock
// server for development, end-to-end tests and Lighthouse.
//
// `createHandlers(stateResolver)` returns one catch-all handler for `/api/v2/*` that
//   1. validates the request against the contract (a request matching no operation is a violation),
//   2. applies the server idle timeout and injected failures,
//   3. delegates to the typed handlers of each area, with the request's scenario state,
//   4. validates the response against the contract,
//   5. renews the session's idle timer (every answer except 401) and records the request.
// Any violation is recorded on the scenario and answered with a 500 `mock-contract-violation`.
import { getResponse, http as mswHttp, type RequestHandler } from 'msw'

import {
  contractValidator,
  readRequest,
  readResponse,
  violationResponse,
  type OperationMatch,
} from '../contract/validator'
import { applyIdleTimeout, type ScenarioState } from '../scenarios/state'
import { apiKeyHandlers } from './api-keys'
import { authHandlers } from './auth'
import { problem, sessionAccount, withScenario } from './context'
import { identityHandlers } from './identity'
import { publicConfigHandlers } from './public-config'

/** The typed handlers of every area. Stories add their modules here. */
export const areaHandlers: RequestHandler[] = [
  ...authHandlers,
  ...identityHandlers,
  ...publicConfigHandlers,
  ...apiKeyHandlers,
]

export type StateResolver = (request: Request) => ScenarioState | null

const REDACTED = new Set(['password', 'code', 'otp', 'credential', 'secret', 'token'])

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        REDACTED.has(key) ? '[redacted]' : redact(inner),
      ]),
    )
  }
  return value
}

function injectedFailure(state: ScenarioState, match: OperationMatch): Response | null {
  const failure = state.failures[match.operationId]
  if (!failure) return null
  if (failure.times !== undefined) {
    if (failure.times <= 0) return null
    failure.times -= 1
  }
  const extra: Record<string, unknown> = {}
  const headers: Record<string, string> = {}
  if (failure.status === 429) {
    extra.retryAfter = failure.retryAfter ?? state.behaviour.retryAfter
    headers['Retry-After'] = String(extra.retryAfter)
  }
  if (failure.pendingActions) extra.pendingActions = failure.pendingActions
  return problem(failure.status, failure.type ?? null, extra, headers)
}

export function createHandlers(stateResolver: StateResolver): RequestHandler[] {
  const validator = contractValidator()

  return [
    mswHttp.all('*/api/v2/*', async ({ request }) => {
      const state = stateResolver(request)
      const url = new URL(request.url)
      const label = { method: request.method, path: `${url.pathname}${url.search}` }
      if (!state) {
        return violationResponse({
          at: new Date().toISOString(),
          ...label,
          operationId: null,
          messages: ['no mock scenario for this request'],
        })
      }

      const fail = (operationId: string | null, messages: string[]) => {
        const violation = {
          at: new Date(state.now()).toISOString(),
          ...label,
          operationId,
          messages,
        }
        state.violations.record(violation)
        return violationResponse(violation)
      }

      const requestInfo = await readRequest(request)
      const { match, violations } = validator.validateRequest(requestInfo)
      if (!match || violations.length > 0) return fail(match?.operationId ?? null, violations)

      applyIdleTimeout(state)
      const response =
        injectedFailure(state, match) ??
        (await withScenario(state, () => getResponse(areaHandlers, request.clone())))
      if (!response) return fail(match.operationId, [`no mock handler for ${match.operationId}`])

      const responseViolations = validator.validateResponse(match, await readResponse(response))
      if (responseViolations.length > 0) return fail(match.operationId, responseViolations)

      // The API renews its idle timer on every session request; 401 means there is no session.
      if (response.status !== 401 && sessionAccount(state)) {
        state.session.lastActivityAt = state.now()
      }
      state.requests.push({
        at: state.now(),
        method: request.method,
        path: label.path,
        operationId: match.operationId,
        status: response.status,
        body: redact(requestInfo.body),
        headers: Object.fromEntries(
          [...request.headers].filter(([name]) =>
            ['x-csrf-token', 'x-api-key', 'if-match', 'if-none-match', 'content-type'].includes(
              name,
            ),
          ),
        ),
      })
      return response
    }),
  ]
}
