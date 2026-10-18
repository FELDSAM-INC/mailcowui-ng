// Deleting one domain (UI 002 research D20, data-model §7 "Delete one domain"):
// 1. unavailable, with the counts, while mailboxes or resources are in use (FR-041);
// 2. a fresh deletion preview; when it is not allowed, the blockers and no deletion (US4-AS3);
// 3. the impact with the name typed in its readable or ASCII form (FR-042);
// 4. the deletion with the preview's version: success goes to the list and is announced; an
//    outdated deletion shows the impact again; "not empty" shows the counts; a vanished domain
//    leaves the list; a temporary failure says nothing was deleted and offers a retry (FR-043).
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import type { Domain, DomainDeletionPreview } from '@/api'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteDomain, fetchDeletionPreview, forgetDomain, problemOf } from '../api'
import DeleteBlockers from '../components/delete/DeleteBlockers.vue'
import DeleteImpact from '../components/delete/DeleteImpact.vue'

export type DeletionOutcome = 'deleted' | 'cancelled' | 'blocked' | 'refused' | 'gone' | 'failed'

export function deletionAvailability(
  domain: Pick<Domain, 'usage'>,
): { available: true } | { available: false; mailboxes: number; resources: number } {
  const { mailboxes, resources } = domain.usage
  return mailboxes + resources > 0
    ? { available: false, mailboxes, resources }
    : { available: true }
}

export function useDomainDeletion() {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const router = useRouter()
  const route = useRoute()
  const pending = ref(false)

  const toList = async () => {
    if (route.name !== 'domains') await router.push({ name: 'domains' })
  }

  const inform = (domain: Domain, description: string) =>
    confirm({
      title: t('domains.delete.notDeletedTitle', { name: domain.unicodeName }),
      description,
      confirmLabel: t('common.close'),
      alertOnly: true,
    })

  async function gone(domain: Domain): Promise<DeletionOutcome> {
    forgetDomain(queryClient, domain.name)
    await inform(domain, t('domains.delete.gone'))
    await toList()
    return 'gone'
  }

  async function preview(domain: Domain): Promise<DomainDeletionPreview | DeletionOutcome> {
    try {
      return await fetchDeletionPreview(queryClient, domain.name)
    } catch (error) {
      const problem = problemOf(error)!
      if (problem.status === 404) return gone(domain)
      await inform(domain, problemMessage(problem))
      return 'failed'
    }
  }

  async function start(domain: Domain): Promise<DeletionOutcome> {
    let notice: string | undefined
    for (;;) {
      const current = await preview(domain)
      if (typeof current === 'string') return current
      if (!current.allowed) {
        await confirm({
          title: t('domains.delete.blockedTitle', { name: domain.unicodeName }),
          content: { component: DeleteBlockers, props: { preview: current } },
          confirmLabel: t('common.close'),
          alertOnly: true,
        })
        return 'blocked'
      }
      const confirmed = await confirm({
        title: t('domains.delete.title', { name: domain.unicodeName }),
        content: { component: DeleteImpact, props: { preview: current, domain, notice } },
        confirmLabel: t('domains.delete.confirm'),
        destructive: true,
        requireTyped: {
          accepted: [domain.unicodeName, domain.name],
          ignoreCase: true,
          labelKey: 'domains.delete.typeName',
          labelParams: { name: domain.unicodeName },
        },
      })
      if (!confirmed) return 'cancelled'

      for (;;) {
        pending.value = true
        try {
          await deleteDomain(queryClient, domain.name, current.etag)
          announce(lt('success.domain_removed', domain.unicodeName))
          await toList()
          return 'deleted'
        } catch (error) {
          const problem = problemOf(error)!
          if (problem.status === 412) {
            notice = t('domains.delete.changed')
            break
          }
          if (problem.is('domain-not-empty')) {
            await inform(domain, problemMessage(problem))
            return 'refused'
          }
          if (problem.status === 404) return gone(domain)
          const retry = await confirm({
            title: t('domains.delete.notDeletedTitle', { name: domain.unicodeName }),
            description: `${t('domains.delete.notDeleted')} ${problemMessage(problem)}`,
            confirmLabel: t('common.retry'),
            cancelLabel: t('common.close'),
          })
          if (!retry) return 'failed'
        } finally {
          pending.value = false
        }
      }
    }
  }

  return { pending, start }
}
