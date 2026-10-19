// Resetting a rate-limit bucket (FR-058, legacy "Remove hash"; exported for UI 011's rate-limited
// log): `resetRateLimitBucket` with legacy's outcomes, `success.hash_deleted` for a reset and
// `warning.hash_not_found` when there was nothing to reset (404). Any other refusal is kept as the
// problem: a shared store that is down changed nothing and the same identifier can be sent again.
// Nothing is retried on its own.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'

import { ApiProblem, problemOf } from '@/api'
import { lt } from '@/i18n'

import { resetRateLimitBucket } from '../api'

export interface ResetOutcome {
  kind: 'success' | 'warning'
  message: string
}

export function useResetRateLimitBucket() {
  const client = useQueryClient()
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)

  /** The outcome as legacy reports it, or null when the reset was refused (see `problem`). */
  async function reset(bucketId: string): Promise<ResetOutcome | null> {
    if (pending.value) return null
    pending.value = true
    problem.value = null
    try {
      await resetRateLimitBucket(client, bucketId)
      return { kind: 'success', message: lt('success.hash_deleted') }
    } catch (error) {
      const failure = problemOf(error) ?? ApiProblem.fromParts({ kind: 'problem', cause: error })
      if (failure.status === 404) return { kind: 'warning', message: lt('warning.hash_not_found') }
      problem.value = failure
      return null
    } finally {
      pending.value = false
    }
  }

  return { pending, problem, reset }
}
