// Removing selected own list entries (UI 006 research R19, data-model §8 "List entry removal run"):
// the API removes one entry per request, so the run sends one DELETE per entry, in order, each with
// the entry's version tag. 404 counts as already removed, the run continues after any failure, and
// each result is reported (legacy's alert per entry; UI 002's summary rows). "Retry failed" sends
// only the failed, refused and outdated entries again and keeps the other results. A lost
// connection is reported as "outcome unknown" and never retried on its own.
import { computed, ref, shallowRef } from 'vue'

import { problemOf, type ApiProblem, type SpamPolicyEntry } from '@/api'
import { isRetryable, type BulkRow, type BulkRowOutcome } from '@/shared/components/bulk-row'

export interface RemoveEntriesOptions {
  remove: (entry: SpamPolicyEntry) => Promise<void>
  /** Called once after each run (the lists are refreshed once, not per entry). */
  finished?: (rows: readonly BulkRow[]) => unknown
}

function outcomeOf(problem: ApiProblem): BulkRowOutcome {
  if (problem.kind === 'network') return 'unknown'
  switch (problem.status) {
    case 404:
      return 'notFound'
    case 412:
      return 'outdated'
    case 403:
      return 'refused'
    default:
      return 'failed'
  }
}

export function useRemoveEntries(options: RemoveEntriesOptions) {
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  /** The entries of the results, for a retry. */
  let entries: SpamPolicyEntry[] = []

  async function send(batch: readonly SpamPolicyEntry[]): Promise<BulkRow[]> {
    const results: BulkRow[] = []
    for (const entry of batch) {
      const row: BulkRow = { id: String(entry.id), label: entry.pattern, outcome: 'done' }
      try {
        await options.remove(entry)
      } catch (error) {
        const problem = problemOf(error)!
        row.outcome = outcomeOf(problem)
        row.problem = problem
      }
      results.push(row)
    }
    return results
  }

  async function finish(results: BulkRow[]): Promise<BulkRow[]> {
    rows.value = results
    phase.value = 'results'
    await options.finished?.(results)
    return results
  }

  /** Removes the entries, one after another. */
  async function run(batch: readonly SpamPolicyEntry[]): Promise<BulkRow[]> {
    phase.value = 'running'
    entries = [...batch]
    return finish(await send(batch))
  }

  /** Sends the failed, refused and outdated entries again; the other results stay. */
  async function retry(): Promise<BulkRow[]> {
    const again = new Set(rows.value.filter(isRetryable).map((row) => row.id))
    const batch = entries.filter((entry) => again.has(String(entry.id)))
    if (batch.length === 0) return rows.value
    phase.value = 'running'
    const retried = new Map((await send(batch)).map((row) => [row.id, row]))
    return finish(rows.value.map((row) => retried.get(row.id) ?? row))
  }

  function close() {
    phase.value = 'idle'
    rows.value = []
    entries = []
  }

  return {
    phase,
    rows,
    /** The IDs of the entries that may be retried (they stay selected). */
    failedIds: computed(() => rows.value.filter(isRetryable).map((row) => row.id)),
    run,
    retry,
    close,
  }
}
