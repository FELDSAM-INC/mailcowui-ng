// Bulk actions of a routing list (research R5, conventions "Bulk actions"): one request with each
// selected entry and its version as listed; a deletion is confirmed with legacy's
// `#ConfirmDeleteModal` texts and the number typed; one result row per entry with legacy's message
// of the single action; refused, outdated and failed entries stay selected for a retry (with the
// refreshed list's versions, without asking again); a whole-request refusal is one message; a lost
// connection reports every entry as "outcome unknown", clears the selection and retries nothing.
import { computed, ref, shallowRef, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type BulkResult, type BulkTarget } from '@/api'
import { lt, resolveText } from '@/i18n'
import { isRetryable, rowsFromBulkResult, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import EntryNameList from '../components/common/EntryNameList.vue'
import {
  bulkActionLabel,
  isDestructive,
  type AnyBulkAction,
  type BulkCollection,
} from '../logic/bulk-actions'

export interface RoutingBulkOptions<T> {
  collection: BulkCollection
  selection: BulkSelection
  /** The entries of the current page. */
  entries: () => readonly T[]
  /** The selection ID of an entry (its ID, or a forwarding host's address). */
  idOf: (entry: T) => string
  /** The readable name of an entry in the confirmation and the results. */
  nameOf: (entry: T) => string
  targetOf: (entry: T) => BulkTarget
  send: (action: AnyBulkAction, targets: BulkTarget[]) => Promise<BulkResult>
  /** Refetches the list before a retry, so that outdated entries carry their new version. */
  refetch: () => Promise<unknown>
  /** Legacy's message of the single action for a row, or null for the shared outcome text. */
  message?: (row: BulkRow, entry: T | undefined, action: AnyBulkAction) => string | null
  /** Extra content of a deletion confirmation, for example a relayhost's usage. */
  deleteImpact?: (entries: readonly T[]) => {
    component: Component
    props?: Record<string, unknown>
  }
}

export function useRoutingBulk<T>(options: RoutingBulkOptions<T>) {
  const { t } = useI18n()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  const action = ref<AnyBulkAction | null>(null)
  /** The entries of the last run, by ID, for the row messages. */
  let sent = new Map<string, T>()

  function selected(): T[] {
    const ids = options.selection.ids.value
    return options.entries().filter((entry) => ids.has(options.idOf(entry)))
  }

  function confirmDeletion(entries: readonly T[]): Promise<boolean> {
    const impact = options.deleteImpact?.(entries)
    return confirm({
      title: lt('footer.confirm_delete'),
      description: lt('footer.delete_these_items'),
      content: impact ?? {
        component: EntryNameList,
        props: { names: entries.map((entry) => options.nameOf(entry)) },
      },
      confirmLabel: lt('footer.delete_now'),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
      requireTyped: {
        accepted: [String(entries.length)],
        labelKey: 'bulk.confirm.typeCount',
        labelParams: { count: entries.length },
      },
    })
  }

  async function run(next: AnyBulkAction, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) await options.refetch()
    const entries = selected()
    if (entries.length === 0) return
    if (!retrying && isDestructive(next) && !(await confirmDeletion(entries))) return
    action.value = next
    sent = new Map(entries.map((entry) => [options.idOf(entry), entry]))
    phase.value = 'running'
    running.value = entries.length
    problem.value = null
    announce(t('bulk.progress', { count: entries.length }))
    const labels = entries.map((entry) => ({
      name: options.idOf(entry),
      unicodeName: options.nameOf(entry),
    }))
    try {
      const result = await options.send(
        next,
        entries.map((entry) => options.targetOf(entry)),
      )
      rows.value = rowsFromBulkResult(result, labels)
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = labels.map((label) => ({
          id: label.name,
          label: label.unicodeName,
          outcome: 'unknown',
        }))
        options.selection.clear()
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
    running,
    problem,
    action,
    /** The bulk actions of the list with their legacy labels. */
    label: (value: AnyBulkAction) => resolveText(bulkActionLabel(options.collection, value), t),
    message: (row: BulkRow) =>
      action.value && options.message ? options.message(row, sent.get(row.id), action.value) : null,
    canRetry: computed(() => rows.value.some(isRetryable) && options.selection.count.value > 0),
    run: (next: AnyBulkAction) => run(next, false),
    retry: () => (action.value ? run(action.value, true) : Promise.resolve()),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}

export type RoutingBulk = ReturnType<typeof useRoutingBulk>
