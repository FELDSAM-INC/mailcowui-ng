// Running a connection test (research R11, data-model §7 "Connection test"): one request at a
// time with an `AbortSignal`, a mutation of the client's mutation cache (`runMutation`) so that
// the session reactions apply, removed from the cache once settled so that nothing is kept (a
// `gcTime` of 0 would reschedule its removal without pause while the test runs); progress
// announced at the start (legacy's `footer.loading`); a watchdog at the server's total test
// timeout plus 15 seconds that aborts the request and reports that no result arrived; leaving the
// page aborts and forgets everything. Running again replaces the result.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import {
  ApiProblem,
  isApiProblem,
  runMutation,
  type RoutingConnectionTestRequest,
  type RoutingConnectionTestResult,
} from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'

import { runConnectionTest, type ConnectionTestKind } from '../api/connection-test'

export const WATCHDOG_MARGIN_SECONDS = 15

const MUTATION_KEY = ['routing-connection-test'] as const

export function useConnectionTest(options: {
  kind: () => ConnectionTestKind
  id: () => number
  /** The server's total test timeout in seconds. */
  totalTimeoutSeconds: () => number | undefined
}) {
  const state = ref<'idle' | 'running' | 'result' | 'noResult'>('idle')
  const result = shallowRef<RoutingConnectionTestResult | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  let controller: AbortController | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  let timedOut = false

  const client = useQueryClient()

  function stopWatchdog() {
    if (watchdog) clearTimeout(watchdog)
    watchdog = null
  }

  async function run(body: RoutingConnectionTestRequest): Promise<void> {
    if (state.value === 'running') return
    controller = new AbortController()
    timedOut = false
    state.value = 'running'
    result.value = null
    problem.value = null
    announce(lt('footer.loading'))
    const total = options.totalTimeoutSeconds() ?? 60
    watchdog = setTimeout(
      () => {
        timedOut = true
        controller?.abort()
      },
      (total + WATCHDOG_MARGIN_SECONDS) * 1000,
    )
    try {
      result.value = await runMutation<RoutingConnectionTestResult, RoutingConnectionTestRequest>(
        client,
        {
          mutationKey: MUTATION_KEY,
          mutationFn: (request) =>
            runConnectionTest(options.kind(), options.id(), request, controller!.signal),
        },
        body,
      )
      state.value = 'result'
    } catch (error) {
      if (timedOut) {
        state.value = 'noResult'
      } else {
        problem.value = isApiProblem(error)
          ? error
          : ApiProblem.fromParts({ kind: 'network', cause: error })
        state.value = 'idle'
      }
    } finally {
      stopWatchdog()
      controller = null
      forgetSettled()
    }
  }

  /** Removes the settled test mutations from the cache, with their pending removal timers. */
  function forgetSettled() {
    const cache = client.getMutationCache()
    for (const mutation of cache.findAll({ mutationKey: MUTATION_KEY })) {
      if (mutation.state.status === 'pending') continue
      mutation.destroy()
      cache.remove(mutation)
    }
  }

  function reset() {
    stopWatchdog()
    controller?.abort()
    controller = null
    state.value = 'idle'
    result.value = null
    problem.value = null
  }

  onScopeDispose(reset)

  return {
    state,
    result,
    problem,
    running: computed(() => state.value === 'running'),
    run,
    reset,
  }
}
