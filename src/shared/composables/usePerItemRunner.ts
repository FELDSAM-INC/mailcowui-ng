// One request per item (UI 005 research R15, data-model §2; conventions "Bulk actions"), for the
// multi-item actions that have no API bulk operation: temporary aliases and Sieve filters. The
// items are sent strictly one after another, each with its own version tag (the caller's `send`
// puts it in `If-Match`). Each ends `done`, `notFound` (404), `outdated` (412), `refused` (403,
// with the problem), `failed` (any other answer) or `unknown` (the connection was lost: the run
// stops there, the rest is `notProcessed`, and nothing is retried). The rows have the shape of
// UI 002's `BulkResultSummary`; the items that did not succeed stay selected for a retry.
import { computed, ref, shallowRef } from 'vue'

import { ApiProblem, isApiProblem, reportSessionProblem } from '@/api'

import type { BulkRow, BulkRowOutcome } from '../components/bulk-row'

export interface PerItem {
  id: string
  /** The readable name of the item in the summary. */
  label: string
}

function outcomeOf(problem: ApiProblem): BulkRowOutcome {
  if (problem.kind === 'network') return 'unknown'
  if (problem.status === 404) return 'notFound'
  if (problem.status === 412) return 'outdated'
  if (problem.status === 403) return 'refused'
  return 'failed'
}

export function usePerItemRunner() {
  const running = ref(false)
  const progress = ref({ current: 0, total: 0 })
  const rows = shallowRef<BulkRow[]>([])

  async function run<T extends PerItem>(
    items: readonly T[],
    send: (item: T) => Promise<unknown>,
  ): Promise<BulkRow[]> {
    if (running.value) return []
    running.value = true
    progress.value = { current: 0, total: items.length }
    const collected: BulkRow[] = []
    try {
      for (const [index, item] of items.entries()) {
        progress.value = { current: index + 1, total: items.length }
        try {
          await send(item)
          collected.push({ id: item.id, label: item.label, outcome: 'done' })
        } catch (error) {
          const problem = isApiProblem(error)
            ? error
            : ApiProblem.fromParts({ kind: 'network', cause: error })
          reportSessionProblem(problem)
          const outcome = outcomeOf(problem)
          collected.push({ id: item.id, label: item.label, outcome, problem })
          if (outcome === 'unknown') {
            for (const rest of items.slice(index + 1)) {
              collected.push({ id: rest.id, label: rest.label, outcome: 'notProcessed' })
            }
            break
          }
        }
      }
    } finally {
      running.value = false
    }
    rows.value = collected
    return collected
  }

  /** The items that did not succeed, to keep selected. */
  const notDone = computed(() =>
    rows.value.filter((row) => row.outcome !== 'done').map((row) => row.id),
  )

  function clear() {
    rows.value = []
  }

  return { running, progress, rows, notDone, run, clear }
}
