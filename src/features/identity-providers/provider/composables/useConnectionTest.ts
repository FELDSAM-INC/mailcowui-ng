// The connection test of candidate settings (FR-033 to FR-038, research R16): one test at a time,
// a 90-second limit after which the request is aborted and "no result was received" is reported,
// and the result kept in the component only (never stored, gone when the screen is left). The
// request is a direct client call, because a candidate may carry a typed secret.
import { onScopeDispose, ref, shallowRef } from 'vue'

import { ApiProblem, isApiProblem, type IdentityProviderConnectionTestResult } from '@/api'

import { testIdentityProviderConnection } from '../api'
import type { ProviderInput } from '../form-model'

/** The client's limit for one test (FR-035): the API's 7-second provider calls stay well within. */
export const TEST_LIMIT_MS = 90_000

export type TestOutcome = 'done' | 'failed' | 'noResult' | 'busy'

export function useConnectionTest(options: { limitMs?: number } = {}) {
  const running = ref(false)
  const result = shallowRef<IdentityProviderConnectionTestResult | null>(null)
  const noResult = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)
  let controller: AbortController | null = null

  async function run(candidate: ProviderInput): Promise<TestOutcome> {
    if (running.value) return 'busy'
    running.value = true
    result.value = null
    noResult.value = false
    problem.value = null
    const current = new AbortController()
    controller = current
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      current.abort()
    }, options.limitMs ?? TEST_LIMIT_MS)
    try {
      result.value = await testIdentityProviderConnection(candidate, current.signal)
      return 'done'
    } catch (error) {
      if (timedOut) {
        noResult.value = true
        return 'noResult'
      }
      if (current.signal.aborted) return 'failed'
      problem.value = isApiProblem(error)
        ? error
        : ApiProblem.fromParts({ kind: 'network', cause: error })
      return 'failed'
    } finally {
      clearTimeout(timer)
      if (controller === current) controller = null
      running.value = false
    }
  }

  /** Forgets the result, and stops a test that is still running. */
  function reset() {
    controller?.abort()
    result.value = null
    noResult.value = false
    problem.value = null
  }

  onScopeDispose(() => controller?.abort())

  return { running, result, noResult, problem, run, reset }
}
