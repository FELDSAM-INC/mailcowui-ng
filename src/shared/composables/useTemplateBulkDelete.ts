// Confirm the count once; retain only retryable rows and refresh their versions before retry.
// A lost connection has unknown outcomes, so clear selection rather than silently retrying.
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type BulkResult, type BulkTarget } from '@/api'
import { lt } from '@/i18n'
import TemplateDeleteList from '@/shared/components/TemplateDeleteList.vue'
import {
  isRetryable,
  rowsFromBulkResult,
  unknownRows,
  type BulkRow,
} from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import type { DeletableTemplate } from './useTemplateDeletion'

const entriesOf = (templates: readonly DeletableTemplate[]) =>
  templates.map((item) => ({ name: String(item.id), unicodeName: item.name }))

export function useTemplateBulkDelete<T extends DeletableTemplate>(
  options: { selection: BulkSelection; entries: () => readonly T[] },
  adapter: {
    listsKey: QueryKey
    deleteTemplates: (client: QueryClient, targets: BulkTarget[]) => Promise<BulkResult>
    keepValuesKey: string
  },
) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  let confirmed = false

  function selected(): T[] {
    const ids = options.selection.ids.value
    return options.entries().filter((item) => ids.has(String(item.id)) && !item.isDefault)
  }

  function ask(templates: readonly T[]): Promise<boolean> {
    return confirm({
      title: lt('footer.confirm_delete'),
      description: lt('footer.delete_these_items'),
      content: {
        component: TemplateDeleteList,
        props: { names: templates.map((item) => item.name), keepValuesKey: adapter.keepValuesKey },
      },
      confirmLabel: lt('footer.delete_now'),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
      requireTyped: {
        accepted: [String(templates.length)],
        labelKey: 'bulk.confirm.typeCount',
        labelParams: { count: templates.length },
      },
    })
  }

  async function run(retrying = false) {
    if (phase.value === 'running') return
    if (retrying) {
      await queryClient.refetchQueries(
        { queryKey: adapter.listsKey, type: 'active', stale: true },
        { cancelRefetch: false },
      )
    }
    const templates = selected()
    if (templates.length === 0) return
    if (!retrying && !(await ask(templates))) return
    confirmed = true
    phase.value = 'running'
    running.value = templates.length
    problem.value = null
    announce(t('bulk.progress', { count: templates.length }))
    try {
      const result = await adapter.deleteTemplates(
        queryClient,
        templates.map((item) => ({ id: String(item.id), version: item.etag })),
      )
      rows.value = rowsFromBulkResult(result, entriesOf(templates))
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = unknownRows(entriesOf(templates))
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
    run: () => run(false),
    retry: () => (confirmed ? run(true) : Promise.resolve()),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}
