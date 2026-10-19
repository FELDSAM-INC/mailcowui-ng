// Shared gate of the operations handlers (UI 011 T014, research R21): administrators only (API
// 011 FR-001: 401 without a session, 403 forbidden for other roles), then the scenario's injection
// for the operation (`state.operations.inject`): a delay, a documented problem answer, and the
// `Audit-Recorded: false` header on the answer.
import type { OperationInjection } from '../scenarios/operations/state'
import type { ScenarioState } from '../scenarios/state'
import { problem, requireAccount, scenario } from './context'

export interface OperationGate {
  state: ScenarioState
  /** The answer that ends the request here (no session, not an administrator, an injected problem). */
  stop: Response | null
  /** Adds the injected headers to the operation's own answer. */
  finish(response: Response): Response
}

/** Consumes one use of an injection; null when it does not apply (any more). */
function take(state: ScenarioState, operationId: string): OperationInjection | null {
  const injection = state.operations.inject[operationId]
  if (!injection) return null
  if (injection.times !== undefined) {
    if (injection.times <= 0) return null
    injection.times -= 1
  }
  return injection
}

function withAuditHeader(response: Response, injection: OperationInjection | null): Response {
  if (injection?.auditRecorded !== false) return response
  const headers = new Headers(response.headers)
  headers.set('Audit-Recorded', 'false')
  return new Response(response.body, { status: response.status, headers })
}

/** The problem an injection answers with, with its documented headers and extension members. */
export function injectedProblem(injection: OperationInjection & { status: number }): Response {
  const headers: Record<string, string> = {}
  if (injection.status === 503) headers['Retry-After'] = String(injection.retryAfter ?? 30)
  if (injection.auditRecorded === false) headers['Audit-Recorded'] = 'false'
  const extra: Record<string, unknown> = { ...injection.extensions }
  if (injection.errors) extra.errors = injection.errors
  return problem(injection.status, injection.problemType ?? null, extra, headers)
}

export async function operationGate(operationId: string): Promise<OperationGate> {
  const state = scenario()
  const account = requireAccount(state)
  if (account instanceof Response) return { state, stop: account, finish: (r) => r }
  if (account.role !== 'admin') {
    return { state, stop: problem(403, 'forbidden'), finish: (r) => r }
  }
  const injection = take(state, operationId)
  if (injection?.delayMs) await new Promise((resolve) => setTimeout(resolve, injection.delayMs))
  if (injection?.status !== undefined) {
    return {
      state,
      stop: injectedProblem(injection as OperationInjection & { status: number }),
      finish: (r) => r,
    }
  }
  return { state, stop: null, finish: (response) => withAuditHeader(response, injection) }
}
