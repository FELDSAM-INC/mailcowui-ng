import { useQueryClient } from '@tanstack/vue-query'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys, type ApiProblem, type RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { deleteRule, fetchRule } from '../api/rspamd-rules'
export function useRuleRemoval(afterRemove?: () => void | Promise<void>) {
  const client = useQueryClient(),
    { t } = useI18n()
  const pending = ref(false),
    removed = ref<number | null>(null),
    problem = shallowRef<ApiProblem | null>(null)
  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })
  async function remove(item: RspamdSettingsRule) {
    if (pending.value || disposed) return
    pending.value = true
    removed.value = null
    problem.value = null
    let fresh = item
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (
          !(await confirm({
            title: attempt ? t('sections.outdated.title') : lt('footer.confirm_delete'),
            description: t('systemSettings.rules.deleteImpact', {
              id: fresh.id,
              description: fresh.description,
            }),
            confirmLabel: lt('footer.delete_now'),
            destructive: true,
          }))
        )
          return
        if (disposed) return
        try {
          await deleteRule(client, fresh)
        } catch (error) {
          if (disposed) return
          if (problemOf(error)?.status !== 412 || attempt) throw error
          fresh = await fetchRule(item.id)
          if (disposed) return
          client.setQueryData(queryKeys.rspamdRules.detail(fresh.id), fresh)
          void client.invalidateQueries({ queryKey: queryKeys.rspamdRules.lists() })
          continue
        }
        if (!disposed) {
          removed.value = fresh.id
          announce(lt('success.settings_map_removed', String(fresh.id)))
          await afterRemove?.()
        }
        return
      }
    } catch (error) {
      if (!disposed) problem.value = problemOf(error)
    } finally {
      pending.value = false
    }
  }
  return { pending, removed, problem, remove }
}
