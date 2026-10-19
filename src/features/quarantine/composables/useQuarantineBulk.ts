import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type QuarantineItem } from '@/api'
import {
  isRetryable,
  rowsFromBulkResult,
  unknownRows,
  type BulkRow,
} from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'

import { bulkItemLines, type OutcomeLine } from '../action-outcome'
import { applyQuarantineBulk, type ItemActionKind } from '../api'
import { askQuarantineBulk } from '../bulk-confirmations'

export function useQuarantineBulk(options: {
  selection: BulkSelection
  entries: () => readonly QuarantineItem[]
  refresh: () => Promise<unknown>
}) {
  const client = useQueryClient()
  const { t } = useI18n()
  const phase = ref<'idle' | 'confirming' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const problem = shallowRef<ApiProblem | null>(null)
  const running = ref(0)
  const busy = computed(() => phase.value === 'confirming' || phase.value === 'running')
  const items = shallowRef<readonly QuarantineItem[]>([])
  const lines = shallowRef(new Map<string, OutcomeLine[]>())
  let last: ItemActionKind | null = null

  async function run(action: ItemActionKind, retrying = false) {
    if (busy.value) return
    const previousPhase = phase.value
    phase.value = 'confirming'
    try {
      if (retrying) await options.refresh()
      const retryIds = new Set(rows.value.filter(isRetryable).map((row) => row.id))
      const selected = options
        .entries()
        .filter(
          (item) =>
            options.selection.isSelected(String(item.id)) &&
            (!retrying || retryIds.has(String(item.id))),
        )
      if (selected.length === 0 || !(await askQuarantineBulk(action, selected))) {
        phase.value = previousPhase
        return
      }
      // A page/filter change can clear selection while the dialog is open.
      if (selected.some((item) => !options.selection.isSelected(String(item.id)))) {
        phase.value = previousPhase
        return
      }
      last = action
      items.value = selected
      rows.value = []
      lines.value = new Map()
      problem.value = null
      phase.value = 'running'
      running.value = selected.length
      announce(t('bulk.progress', { count: selected.length }))
      const entries = selected.map((item) => ({
        name: String(item.id),
        unicodeName: String(item.id),
      }))
      try {
        const result = await applyQuarantineBulk(client, {
          action,
          targets: selected.map((item) => ({ id: String(item.id), version: item.etag })),
        })
        rows.value = rowsFromBulkResult(result, entries)
        lines.value = new Map(
          result.results.map((item) => [
            item.id,
            bulkItemLines(action, { id: item.id, outcome: item.outcome, report: item.report }),
          ]),
        )
        options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
      } catch (error) {
        const failure = problemOf(error)!
        if (failure.kind === 'network') {
          rows.value = unknownRows(entries)
          options.selection.clear()
        } else {
          problem.value = failure
        }
      }
      phase.value = 'results'
    } catch (error) {
      // A failed refresh must not retry with a version whose state is unknown.
      problem.value = problemOf(error)
      phase.value = 'results'
    } finally {
      running.value = 0
    }
  }

  return {
    phase,
    rows,
    problem,
    busy,
    running,
    itemFor: (id: string) => items.value.find((item) => String(item.id) === id),
    linesFor: (id: string) => lines.value.get(id) ?? [],
    run: (action: ItemActionKind) => run(action),
    retry: () =>
      last && rows.value.some(isRetryable) && options.selection.count.value > 0
        ? run(last, true)
        : Promise.resolve(),
    close() {
      if (busy.value) return
      phase.value = 'idle'
      rows.value = []
      items.value = []
      lines.value = new Map()
      problem.value = null
    },
  }
}
