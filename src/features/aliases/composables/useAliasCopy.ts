// "Expand alias over alias domains" for one alias from the list (FR-031, FR-032, research R12; plan
// part 3, item 8): the explanation first, then the copy with the alias's version. A 412 reloads the
// alias and explains again; a vanished alias is reported; other refusals (for example an alias in
// an alias domain, legacy's `warning.is_not_primary_alias`) are shown as legacy's alert.
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys, type Alias, type AliasCopyReport } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { confirm } from '@/shared/composables/useConfirm'

import { copyAlias, fetchAlias, invalidateAfterAliasChange } from '../api'
import type { AliasOutcome } from './useAliasDeletion'

export function useAliasCopy(handlers: {
  report: (outcome: AliasOutcome) => void
  copied: (report: AliasCopyReport) => void
}) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const pending = ref(false)

  function gone() {
    invalidateAfterAliasChange(queryClient)
    handlers.report({ kind: 'danger', message: t('aliases.gone') })
  }

  async function start(initial: Alias) {
    if (pending.value) return
    let alias = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('mailbox.add_alias_expand'),
        description: notice ?? t('aliases.copy.explain'),
        confirmLabel: lt('mailbox.add_alias_expand'),
        cancelLabel: lt('footer.cancel'),
      })
      if (!confirmed) return
      pending.value = true
      try {
        handlers.copied(await copyAlias(queryClient, alias.id, alias.etag))
        return
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            alias = await fetchAlias(alias.id)
            queryClient.setQueryData(queryKeys.aliases.detail(alias.id), alias)
            notice = t('aliases.changed')
            continue
          } catch {
            gone()
            return
          }
        }
        if (problem.status === 404) {
          gone()
          return
        }
        handlers.report({
          kind: 'danger',
          message: problemMessage(problem, { params: { address: alias.address } }),
        })
        return
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending }
}
