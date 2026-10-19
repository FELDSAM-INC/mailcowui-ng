// Requests that carry secrets (conventions "Shared building blocks": useSecretRequest). Private
// keys, passwords and generated secrets never go through TanStack Query caches: this is a direct
// client call with loading, error and result state held by the calling component only. A second
// call while one is pending is ignored. The result is forgotten when the component goes away.
// Session-level problems (an ended session, a missing permission) still reach the session
// reactions. Created by UI 001 for API key creation; UI 005, 010 and 012 reuse it.
import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from 'vue'

import { ApiProblem, isApiProblem, reportSessionProblem } from '@/api'

export interface SecretRequest<A extends unknown[], R> {
  pending: Ref<boolean>
  problem: ShallowRef<ApiProblem | null>
  result: ShallowRef<R | null>
  /** Sends the request; resolves with its result, or null after a failure or while pending. */
  run(...args: A): Promise<R | null>
  /** Forgets the result and the problem. */
  clear(): void
}

export interface SecretRequestOptions {
  /**
   * UI 005 (research R6): `false` keeps the session reactions out of it. Only the password reset
   * completion uses it: its `401 second-factor-required` asks for a factor for the reset, not for
   * a pending sign-in.
   */
  sessionReactions?: boolean
}

export function useSecretRequest<A extends unknown[], R>(
  request: (...args: A) => Promise<R>,
  options: SecretRequestOptions = {},
): SecretRequest<A, R> {
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)
  const result = shallowRef<R | null>(null)

  async function run(...args: A): Promise<R | null> {
    if (pending.value) return null
    pending.value = true
    problem.value = null
    result.value = null
    try {
      const value = await request(...args)
      result.value = value
      return value
    } catch (error) {
      const failure = isApiProblem(error)
        ? error
        : ApiProblem.fromParts({ kind: 'network', cause: error })
      problem.value = failure
      if (options.sessionReactions !== false) reportSessionProblem(failure)
      return null
    } finally {
      pending.value = false
    }
  }

  function clear() {
    result.value = null
    problem.value = null
  }

  onScopeDispose(clear)

  return { pending, problem, result, run, clear }
}
