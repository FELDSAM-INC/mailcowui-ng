// Bulk actions on domains (UI 002 research D22, data-model §7 "Bulk action on domains", FR-045 to
// FR-048): one request with the API's bulk operation and each domain's version tag; activation
// without a confirmation, deactivation with one, deletion with the impact and the number typed,
// leaving out domains with mailboxes or resources. The result has one row per domain; failed,
// refused and outdated domains stay selected for a retry with the refreshed list's version tags,
// which repeats the confirmed action without asking again.
// A lost connection reports every domain as "outcome unknown", clears the selection and retries
// nothing.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { queryKeys, type ApiProblem, type Domain } from '@/api'
import { isRetryable, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import { applyBulkAction, problemOf } from '../api'
import {
  partitionDeletable,
  rowsFromBulkResult,
  skippedRows,
  toBulkTargets,
  unknownRows,
} from '../bulk'
import BulkDeactivateList from '../components/delete/BulkDeactivateList.vue'
import BulkDeleteImpact from '../components/delete/BulkDeleteImpact.vue'

export type DomainBulkAction = 'activate' | 'deactivate' | 'delete'

export function useDomainBulk(options: {
  selection: BulkSelection
  entries: () => readonly Domain[]
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  let lastAction: DomainBulkAction | null = null

  function ask(action: DomainBulkAction, send: Domain[], skipped: Domain[]): Promise<boolean> {
    if (action === 'deactivate') {
      return confirm({
        title: t('domains.bulk.deactivateTitle', { count: send.length }),
        content: { component: BulkDeactivateList, props: { domains: send } },
        confirmLabel: lt('mailbox.deactivate'),
        destructive: true,
      })
    }
    if (action === 'delete' && send.length > 0) {
      return confirm({
        title: t('domains.bulk.deleteTitle', { count: send.length }),
        content: { component: BulkDeleteImpact, props: { deletable: send, skipped } },
        confirmLabel: t('domains.bulk.deleteConfirm'),
        destructive: true,
        requireTyped: {
          accepted: [String(send.length)],
          labelKey: 'bulk.confirm.typeCount',
          labelParams: { count: send.length },
        },
      })
    }
    return Promise.resolve(true)
  }

  /** Waits for a list refetch that a previous action started, so a retry sends fresh versions. */
  async function settleList() {
    await queryClient.refetchQueries(
      { queryKey: queryKeys.domains.lists(), type: 'active', stale: true },
      { cancelRefetch: false },
    )
  }

  async function run(action: DomainBulkAction, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) await settleList()
    const ids = options.selection.ids.value
    const selected = options.entries().filter((domain) => ids.has(domain.name))
    if (selected.length === 0) return
    const { deletable, skipped } =
      action === 'delete' ? partitionDeletable(selected) : { deletable: selected, skipped: [] }
    // A retry repeats an action the user confirmed, for some of the same domains.
    if (!retrying && !(await ask(action, deletable, skipped))) return
    lastAction = action
    problem.value = null
    if (deletable.length === 0) {
      rows.value = skippedRows(skipped)
      options.selection.keep([])
      phase.value = 'results'
      return
    }
    phase.value = 'running'
    running.value = deletable.length
    announce(t('domains.bulk.progress', { count: deletable.length }))
    try {
      const result = await applyBulkAction(queryClient, {
        action,
        targets: toBulkTargets(deletable),
      })
      rows.value = [...rowsFromBulkResult(result, deletable), ...skippedRows(skipped)]
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = [...unknownRows(deletable), ...skippedRows(skipped)]
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
    canRetry: computed(() => rows.value.some(isRetryable) && options.selection.count.value > 0),
    run,
    retry: () => (lastAction ? run(lastAction, true) : Promise.resolve()),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}
