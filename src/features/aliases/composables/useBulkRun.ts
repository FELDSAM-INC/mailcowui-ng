// One mass action on a UI 004 list (research R16, conventions "Bulk actions"): the confirmation the
// action needs, one request with each selected entry's version as listed, one result row per
// object, and every object that is not done kept selected. A retry repeats the confirmed action
// with the refreshed list's versions without asking again; "Refresh the list" keeps the selection.
// A lost connection reports every object as "outcome unknown", refreshes the list, keeps the
// selection so the user can check it, and never repeats the request (UI 003 R12's behaviour).
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, problemOf, type BulkResult, type BulkTarget } from '@/api'
import { isRetryable, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'

import { retainedIds, toTargets } from '../alias-bulk'

export interface BulkRunOptions<E extends { etag: string }, A extends string, X> {
  selection: BulkSelection
  entries: () => readonly E[]
  idOf: (entry: E) => string
  labelOf: (entry: E) => string
  /** The confirmation of an action; resolves false when the user cancels. */
  ask: (action: A, selected: readonly E[]) => Promise<boolean>
  send: (action: A, targets: BulkTarget[]) => Promise<{ result: BulkResult; extra?: X }>
  /** Refetches the list, so that a retry sends the current versions. */
  refreshList: () => Promise<unknown>
}

export function useBulkRun<E extends { etag: string }, A extends string, X = never>(
  options: BulkRunOptions<E, A, X>,
) {
  const { t } = useI18n()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const extra = shallowRef<X | undefined>(undefined)
  const action = ref<A | null>(null)
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)

  function rowsOf(result: BulkResult, sent: readonly E[]): BulkRow[] {
    return result.results.map((item) => {
      const entry = sent.find((candidate) => options.idOf(candidate) === item.id)
      return {
        id: item.id,
        label: entry ? options.labelOf(entry) : item.id,
        outcome: item.outcome,
        problem: item.problem
          ? ApiProblem.fromParts({
              kind: 'problem',
              type: item.problem.type,
              status: item.problem.status,
              requestId: item.problem.requestId,
              extensions: Object.fromEntries(
                Object.entries(item.problem).filter(
                  ([key]) => !['type', 'title', 'status', 'detail', 'requestId'].includes(key),
                ),
              ),
            })
          : undefined,
      }
    })
  }

  async function run(next: A, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) await options.refreshList()
    const ids = options.selection.ids.value
    const selected = options.entries().filter((entry) => ids.has(options.idOf(entry)))
    if (selected.length === 0) return
    // A retry repeats an action the user confirmed, for some of the same objects.
    if (!retrying && !(await options.ask(next, selected))) return
    action.value = next
    problem.value = null
    extra.value = undefined
    phase.value = 'running'
    running.value = selected.length
    announce(t('bulk.progress', { count: selected.length }))
    try {
      const answer = await options.send(next, toTargets(selected, options.idOf))
      rows.value = rowsOf(answer.result, selected)
      extra.value = answer.extra
      options.selection.keep(retainedIds(rows.value))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = selected.map((entry) => ({
          id: options.idOf(entry),
          label: options.labelOf(entry),
          outcome: 'unknown',
        }))
        void options.refreshList()
      } else {
        rows.value = []
        problem.value = failure
      }
    } finally {
      running.value = 0
    }
    phase.value = 'results'
  }

  return {
    phase,
    rows,
    extra,
    action,
    running,
    problem,
    canRetry: computed(() => rows.value.some(isRetryable) && options.selection.count.value > 0),
    run,
    retry: () => (action.value ? run(action.value, true) : Promise.resolve()),
    refresh: () => options.refreshList(),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
      extra.value = undefined
    },
  }
}
