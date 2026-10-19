// Creating transports for several destinations (research R10, data-model §7 "Transport batch
// creation", legacy form map decision 10): one direct client call per destination, one after
// another (no mutation cache: the body can carry a password). A refusal that concerns only the
// destination is recorded and the batch goes on; any other refusal or a next hop conflict stops it
// (the rest is "not processed"); a lost connection stops it with that destination "outcome
// unknown". The other transports whose shared credentials changed are collected, without the
// batch's own creations.
import { ref, shallowRef } from 'vue'

import {
  ApiProblem,
  isApiProblem,
  reportSessionProblem,
  type Transport,
  type TransportCreateRequest,
  type TransportReference,
  type Writable,
} from '@/api'
import type { BulkRow } from '@/shared/components/bulk-row'

import { createTransport } from '../api/transports'
import type { WithDefaults } from '../api/common'

export type TransportBody = Omit<
  WithDefaults<Writable<TransportCreateRequest>, 'active' | 'mxBased'>,
  'destination'
>

export interface BatchResult {
  destination: string
  outcome: 'created' | 'refused' | 'outcomeUnknown' | 'notSent'
  transport?: Transport
  problem?: ApiProblem
}

/** Whether a refusal concerns only the destination, so the batch goes on. */
function destinationOnly(problem: ApiProblem): boolean {
  if (problem.problemName === 'routing-entry-exists')
    return problem.extensions.field === 'destination'
  if (problem.status !== 422) return false
  const fields = [...problem.fieldErrors.keys()]
  return fields.length > 0 && fields.every((field) => field === 'destination')
}

export function useTransportCreateBatch() {
  const running = ref(false)
  const results = shallowRef<BatchResult[]>([])
  const affected = shallowRef<TransportReference[]>([])
  const stoppedBy = shallowRef<ApiProblem | null>(null)

  async function run(destinations: readonly string[], body: TransportBody): Promise<BatchResult[]> {
    if (running.value) return results.value
    running.value = true
    stoppedBy.value = null
    const done: BatchResult[] = []
    const others = new Map<number, TransportReference>()
    try {
      for (const [index, destination] of destinations.entries()) {
        try {
          const write = await createTransport({ ...body, destination })
          done.push({ destination, outcome: 'created', transport: write.transport })
          for (const reference of write.affectedTransports) others.set(reference.id, reference)
        } catch (error) {
          const problem = isApiProblem(error)
            ? error
            : ApiProblem.fromParts({ kind: 'network', cause: error })
          reportSessionProblem(problem)
          if (problem.kind === 'network') {
            done.push({ destination, outcome: 'outcomeUnknown' })
          } else {
            done.push({ destination, outcome: 'refused', problem })
            if (destinationOnly(problem)) continue
          }
          stoppedBy.value = problem
          for (const rest of destinations.slice(index + 1)) {
            done.push({ destination: rest, outcome: 'notSent' })
          }
          break
        }
      }
    } finally {
      running.value = false
    }
    const created = new Set(done.flatMap((item) => (item.transport ? [item.transport.id] : [])))
    affected.value = [...others.values()].filter((reference) => !created.has(reference.id))
    results.value = done
    return done
  }

  /** The results as rows of the shared result summary. */
  function rows(): BulkRow[] {
    return results.value.map((item) => ({
      id: item.destination,
      label: item.destination,
      outcome:
        item.outcome === 'created'
          ? 'done'
          : item.outcome === 'refused'
            ? 'refused'
            : item.outcome === 'outcomeUnknown'
              ? 'unknown'
              : 'notProcessed',
      problem: item.problem,
    }))
  }

  return {
    running,
    results,
    affected,
    stoppedBy,
    run,
    rows,
    clear() {
      results.value = []
      affected.value = []
      stoppedBy.value = null
    },
  }
}
