// Deleting one alias from the list (FR-029, FR-030, research R11; docs/conventions.md
// "Confirmations"): legacy's `#ConfirmDeleteModal` texts with the address and its consequences,
// then the deletion with the version tag as listed. Focus starts on Cancel (the dialog's default).
// - 204: legacy's `success.alias_removed` with the address, as an alert; the lists refresh.
// - 412: the alias is reloaded and the confirmation shown again with it (FR-027).
// - 404: the alias no longer exists or left the scope; said so, and the lists refresh (FR-028).
// - Other refusals: the problem's message as legacy's danger alert; nothing is deleted.
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys, type Alias } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteAlias, fetchAlias, invalidateAfterAliasChange } from '../api'
import AliasDeleteImpact from '../components/AliasDeleteImpact.vue'

export interface AliasOutcome {
  kind: 'success' | 'danger'
  message: string
}

export type AliasDeletionResult = 'deleted' | 'cancelled' | 'gone' | 'failed'

export function useAliasDeletion(report: (outcome: AliasOutcome) => void) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const pending = ref(false)

  function gone(): AliasDeletionResult {
    invalidateAfterAliasChange(queryClient)
    report({ kind: 'danger', message: t('aliases.gone') })
    return 'gone'
  }

  async function start(initial: Alias): Promise<AliasDeletionResult> {
    if (pending.value) return 'cancelled'
    let alias = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: { component: AliasDeleteImpact, props: { alias } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      pending.value = true
      try {
        await deleteAlias(queryClient, alias.id, alias.etag)
        report({ kind: 'success', message: lt('success.alias_removed', alias.address) })
        return 'deleted'
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            alias = await fetchAlias(alias.id)
            queryClient.setQueryData(queryKeys.aliases.detail(alias.id), alias)
            notice = t('aliases.changed')
            continue
          } catch {
            return gone()
          }
        }
        if (problem.status === 404) return gone()
        report({ kind: 'danger', message: problemMessage(problem) })
        return 'failed'
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending }
}
