// Running a connection test (research R11, data-model §7 "Connection test"): one request at a
// time with an `AbortSignal`, a mutation with `gcTime: 0` so that the session reactions apply and
// nothing is kept; progress announced at the start (legacy's `footer.loading`); a watchdog at the
// server's total test timeout plus 15 seconds that aborts the request and reports that no result
// arrived; leaving the page aborts and forgets everything. Running again replaces the result.
import { useMutation } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import {
  ApiProblem,
  isApiProblem,
  type RoutingConnectionTestRequest,
  type RoutingConnectionTestResult,
} from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'

import { runConnectionTest, type ConnectionTestKind } from '../api/connection-test'

export const WATCHDOG_MARGIN_SECONDS = 15

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

  const mutation = useMutation({
    mutationFn: (body: RoutingConnectionTestRequest) =>
      runConnectionTest(options.kind(), options.id(), body, controller!.signal),
    gcTime: 0,
  })

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
      result.value = await mutation.mutateAsync(body)
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
    }
  }

  function reset() {
    stopWatchdog()
    controller?.abort()
    controller = null
    mutation.reset()
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
