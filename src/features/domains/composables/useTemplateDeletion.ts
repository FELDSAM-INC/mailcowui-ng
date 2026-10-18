// Deleting one template (UI 002 FR-055, US6-AS4, conventions "Confirmations"): a confirmation that
// names the template and says that domains created from it keep their values; the deletion with
// the template's version tag. An outdated deletion reloads the template and asks again; a template
// that is gone, or another refusal, is explained and nothing is deleted. The Default template has
// no delete action (FR-053).
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import { queryKeys, type DomainTemplate } from '@/api'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import { problemOf } from '../api'
import TemplateDeleteList from '../components/delete/TemplateDeleteList.vue'
import { deleteTemplate, fetchTemplate } from '../templates-api'

export type TemplateDeletionOutcome = 'deleted' | 'cancelled' | 'gone' | 'failed'

export function useTemplateDeletion() {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const router = useRouter()
  const route = useRoute()
  const pending = ref(false)

  const toList = async () => {
    if (route.name !== 'domain-templates') await router.push({ name: 'domain-templates' })
  }

  const inform = (template: DomainTemplate, description: string) =>
    confirm({
      title: t('domainTemplates.delete.notDeletedTitle', { name: template.name }),
      description,
      confirmLabel: t('common.close'),
      alertOnly: true,
    })

  async function start(initial: DomainTemplate): Promise<TemplateDeletionOutcome> {
    if (initial.isDefault || pending.value) return 'cancelled'
    let template = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: { component: TemplateDeleteList, props: { names: [template.name] } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      pending.value = true
      try {
        await deleteTemplate(queryClient, template.id, template.etag)
        announce(lt('success.template_removed', String(template.id)))
        await toList()
        return 'deleted'
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          try {
            template = await fetchTemplate(template.id)
            queryClient.setQueryData(queryKeys.domainTemplates.detail(template.id), template)
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
