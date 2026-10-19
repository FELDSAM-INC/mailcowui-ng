// Deleting one domain alias from the list (FR-029, FR-030, research R11; docs/conventions.md
// "Confirmations"): legacy's `#ConfirmDeleteModal` texts with the name and its consequences, then
// the deletion with the version tag as listed. Focus starts on Cancel (the dialog's default).
// - 204: legacy's `success.alias_domain_removed` with the name, as an alert; the lists refresh.
// - 412: the alias domain is reloaded and the confirmation shown again with it (FR-027).
// - 404: it no longer exists or left the scope; said so, and the lists refresh (FR-028).
// - Other refusals (for example `503 temporary-failure`): the problem's message as a danger alert.
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys, type AliasDomain } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteAliasDomain, fetchAliasDomain, invalidateAfterAliasDomainChange } from '../api'
import AliasDomainDeleteImpact from '../components/AliasDomainDeleteImpact.vue'

export interface AliasDomainOutcome {
  kind: 'success' | 'danger'
  message: string
}

export function useAliasDomainDeletion(report: (outcome: AliasDomainOutcome) => void) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const pending = ref(false)

  function gone() {
    invalidateAfterAliasDomainChange(queryClient)
    report({ kind: 'danger', message: t('aliasDomains.gone') })
    return 'gone' as const
  }

  async function start(initial: AliasDomain) {
    if (pending.value) return 'cancelled' as const
    let item = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: { component: AliasDomainDeleteImpact, props: { aliasDomain: item } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled' as const
      pending.value = true
      try {
        await deleteAliasDomain(queryClient, item.name, item.etag)
        report({ kind: 'success', message: lt('success.alias_domain_removed', item.name) })
        return 'deleted' as const
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            item = await fetchAliasDomain(item.name)
            queryClient.setQueryData(queryKeys.aliasDomains.detail(item.name), item)
            notice = t('aliasDomains.delete.changed')
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
