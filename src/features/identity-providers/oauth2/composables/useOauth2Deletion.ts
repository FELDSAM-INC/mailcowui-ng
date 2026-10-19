// Removing one OAuth2 client from its row (FR-064, conventions "Confirmations"): the classic
// confirmation (`#ConfirmDeleteModal`) naming the client, then the deletion with the version tag
// as listed. An outdated deletion reloads the client and asks again; a client that is gone, or
// another refusal, is reported and nothing is deleted. Success says legacy's
// `success.items_deleted` with the ID.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { problemOf, queryKeys, type ApiProblem, type Oauth2Client } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteOauth2Client, fetchOauth2Client } from '../api'
import ClientIdList from '../components/ClientIdList.vue'

export function useOauth2Deletion() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)

  async function start(initial: Oauth2Client): Promise<'deleted' | 'cancelled' | 'failed'> {
    if (pending.value) return 'cancelled'
    problem.value = null
    let client = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: { component: ClientIdList, props: { clientIds: [client.clientId] } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      pending.value = true
      try {
        await deleteOauth2Client(queryClient, client.id, client.etag)
        announce(lt('success.items_deleted', String(client.id)))
        return 'deleted'
      } catch (error) {
        const failure = problemOf(error)!
        if (failure.status === 412) {
          try {
            client = await fetchOauth2Client(client.id)
            queryClient.setQueryData(queryKeys.oauth2Clients.detail(client.id), client)
            notice = t('problem.status.412')
            continue
          } catch (reload) {
            problem.value = problemOf(reload)
            return 'failed'
          }
        }
        problem.value = failure
        void queryClient.invalidateQueries({ queryKey: queryKeys.oauth2Clients.lists() })
        return 'failed'
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending, problem }
}
