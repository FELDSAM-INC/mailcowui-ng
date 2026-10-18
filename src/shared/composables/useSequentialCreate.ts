// One request per entry (UI 004 data-model §7, research R9): the entries of a multi-entry form are
// sent strictly one after another, in the order entered. Each ends `created`, `refused` or
// `notProcessed`. `classify` tells a refusal that concerns only its entry (the run continues) from
// one that concerns the whole form (the run stops, the rest is not processed). A network failure
// stops the run too. Nothing is retried; the progress is exposed for the pending announcement.
import { computed, ref, shallowRef } from 'vue'

import { ApiProblem, isApiProblem } from '@/api'

import type { ParsedEntry } from '../validation/entry-list'

export type EntryOutcome = 'created' | 'refused' | 'notProcessed'

export interface EntryResult<R> {
  entry: ParsedEntry
  outcome: EntryOutcome
  data?: R
  problem?: ApiProblem
}

export type RefusalScope = 'entry' | 'form'

export function useSequentialCreate<R = unknown>() {
  const status = ref<'idle' | 'running' | 'done' | 'stopped'>('idle')
  /** The 1-based position of the entry being sent. */
  const current = ref(0)
  const total = ref(0)
  const results = shallowRef<EntryResult<R>[]>([])
  /** The problem that stopped the run: a form-level refusal or a network failure. */
  const stopProblem = shallowRef<ApiProblem | null>(null)

  async function run(
    entries: readonly ParsedEntry[],
    send: (entry: ParsedEntry) => Promise<R>,
    classify: (problem: ApiProblem) => RefusalScope,
  ): Promise<EntryResult<R>[]> {
    if (status.value === 'running') return results.value
    status.value = 'running'
    stopProblem.value = null
    total.value = entries.length
    const collected: EntryResult<R>[] = []
    const rest = (from: number) => {
      for (const entry of entries.slice(from)) collected.push({ entry, outcome: 'notProcessed' })
    }
    try {
      for (const [position, entry] of entries.entries()) {
        current.value = position + 1
        try {
          collected.push({ entry, outcome: 'created', data: await send(entry) })
        } catch (error) {
          const problem = isApiProblem(error)
            ? error
            : ApiProblem.fromParts({ kind: 'problem', cause: error })
          if (problem.kind === 'network') {
            stopProblem.value = problem
            rest(position)
            status.value = 'stopped'
            return collected
          }
          collected.push({ entry, outcome: 'refused', problem })
          if (classify(problem) === 'form') {
            stopProblem.value = problem
            rest(position + 1)
            status.value = 'stopped'
            return collected
          }
        }
      }
      status.value = 'done'
      return collected
    } finally {
      results.value = collected
      current.value = 0
    }
  }

  function reset() {
    status.value = 'idle'
    results.value = []
    stopProblem.value = null
    current.value = 0
    total.value = 0
  }

  return {
    status,
    current,
    total,
    results,
    stopProblem,
    running: computed(() => status.value === 'running'),
    run,
    reset,
  }
}
