// Deleting several templates (UI 002 FR-055, the classic "Remove" of selected templates), with the
// API's bulk operation (gap G40): one request, each template with its list entry's version tag.
// The confirmation names the templates, says that domains created from them keep their values and
// needs their number typed. The result has one row per template; failed, refused and outdated
// templates stay selected for a retry with the refreshed list's version tags, which repeats the
// confirmed deletion without asking again. A lost connection reports every template as "outcome
// unknown", clears the selection and retries nothing. The Default template is never sent.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { queryKeys, type ApiProblem, type DomainTemplate } from '@/api'
import { isRetryable, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import { problemOf } from '../api'
import { rowsFromBulkResult } from '../bulk'
import TemplateDeleteList from '../components/delete/TemplateDeleteList.vue'
import { applyTemplateBulkAction } from '../templates-api'

const entriesOf = (templates: readonly DomainTemplate[]) =>
  templates.map((item) => ({ name: String(item.id), unicodeName: item.name }))

export function useTemplateBulkDelete(options: {
  selection: BulkSelection
  entries: () => readonly DomainTemplate[]
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  let confirmed = false

  function selected(): DomainTemplate[] {
    const ids = options.selection.ids.value
    return options.entries().filter((item) => ids.has(String(item.id)) && !item.isDefault)
  }

  function ask(templates: readonly DomainTemplate[]): Promise<boolean> {
    return confirm({
      title: lt('footer.confirm_delete'),
      description: lt('footer.delete_these_items'),
      content: {
        component: TemplateDeleteList,
        props: { names: templates.map((item) => item.name) },
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
        { queryKey: queryKeys.domainTemplates.lists(), type: 'active', stale: true },
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
      const result = await applyTemplateBulkAction(queryClient, {
        action: 'delete',
        targets: templates.map((item) => ({ id: String(item.id), version: item.etag })),
      })
      rows.value = rowsFromBulkResult(result, entriesOf(templates))
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = entriesOf(templates).map((entry) => ({
          id: entry.name,
          label: entry.unicodeName,
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
