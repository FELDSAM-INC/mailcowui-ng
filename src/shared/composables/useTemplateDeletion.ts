// Versioned single-template deletion: Default protection, confirmation, conflict reload and
// reconfirmation, outcome announcement and feature-specific list navigation.
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { problemOf, type DomainTemplate } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import TemplateDeleteList from '@/shared/components/TemplateDeleteList.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

export type TemplateDeletionOutcome = 'deleted' | 'cancelled' | 'gone' | 'failed'

/** The shared identity/version fields of the generated domain and mailbox template schemas. */
export type DeletableTemplate = Pick<DomainTemplate, 'id' | 'name' | 'etag' | 'isDefault'>

/** Feature APIs retain their own invalidation and normalization rules. */
export function useTemplateDeletion<T extends DeletableTemplate>(adapter: {
  deleteTemplate: (client: QueryClient, id: number, etag: string) => Promise<void>
  fetchTemplate: (id: number) => Promise<T>
  detailKey: (id: number) => QueryKey
  listRoute: string
  keepValuesKey: string
}) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const router = useRouter()
  const route = useRoute()
  const pending = ref(false)

  const toList = async () => {
    if (route.name !== adapter.listRoute) await router.push({ name: adapter.listRoute })
  }

  const inform = (template: T, description: string) =>
    confirm({
      title: t('domainTemplates.delete.notDeletedTitle', { name: template.name }),
      description,
      confirmLabel: t('common.close'),
      alertOnly: true,
    })

  async function start(initial: T): Promise<TemplateDeletionOutcome> {
    if (initial.isDefault || pending.value) return 'cancelled'
    let template = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: {
          component: TemplateDeleteList,
          props: { names: [template.name], keepValuesKey: adapter.keepValuesKey },
        },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      pending.value = true
      try {
        await adapter.deleteTemplate(queryClient, template.id, template.etag)
        announce(lt('success.template_removed', String(template.id)))
        await toList()
        return 'deleted'
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            template = await adapter.fetchTemplate(template.id)
            queryClient.setQueryData(adapter.detailKey(template.id), template)
            notice = t('domainTemplates.delete.changed')
            continue
          } catch {
            await inform(template, t('domainTemplates.edit.gone'))
            await toList()
            return 'gone'
          }
        }
        if (problem.status === 404) {
          await inform(template, t('domainTemplates.edit.gone'))
          await toList()
          return 'gone'
        }
        await inform(template, `${t('domains.delete.notDeleted')} ${problemMessage(problem)}`)
        return 'failed'
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending }
}
