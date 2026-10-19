// Deleting one resource from the list (FR-029, FR-030, research R11; docs/conventions.md
// "Confirmations"): legacy's `#ConfirmDeleteModal` texts with the description, the address and its consequences, then
// the deletion with the version tag as listed. Focus starts on Cancel (the dialog's default).
// - 204: legacy's `success.resource_removed` with the name, as an alert; the lists refresh.
// - 412: the resource is reloaded and the confirmation shown again with it (FR-027).
// - 404: it no longer exists or left the scope; said so, and the lists refresh (FR-028).
// - Other refusals (for example `503 temporary-failure`): the problem's message as a danger alert.
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys, type Resource } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteResource, fetchResource, invalidateAfterResourceChange } from '../api'
import ResourceDeleteImpact from '../components/ResourceDeleteImpact.vue'

export interface ResourceOutcome {
  kind: 'success' | 'danger'
  message: string
}

export function useResourceDeletion(report: (outcome: ResourceOutcome) => void) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const pending = ref(false)

  function gone() {
    invalidateAfterResourceChange(queryClient)
    report({ kind: 'danger', message: t('resources.gone') })
    return 'gone' as const
  }

  async function start(initial: Resource) {
    if (pending.value) return 'cancelled' as const
    let item = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: { component: ResourceDeleteImpact, props: { resource: item } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled' as const
      pending.value = true
      try {
        await deleteResource(queryClient, item.address, item.etag)
        report({ kind: 'success', message: lt('success.resource_removed', item.address) })
        return 'deleted' as const
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            item = await fetchResource(item.address)
            queryClient.setQueryData(queryKeys.resources.detail(item.address), item)
            notice = t('resources.changed')
            continue
          } catch {
            return gone()
          }
        }
        if (problem.status === 404) return gone()
        report({ kind: 'danger', message: problemMessage(problem) })
        return 'failed' as const
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending }
}
