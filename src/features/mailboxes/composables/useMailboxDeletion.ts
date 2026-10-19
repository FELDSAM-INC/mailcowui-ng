// Deleting one mailbox from the list (US4, data-model §7.2, legacy's `delete_selected` modal):
// 1. a fresh deletion preview; a missing mailbox says so and leaves the list (US4-AS5);
// 2. while a store is unreachable, the blockers with "Check again" (FR-047);
// 3. legacy's confirmation (`footer.confirm_delete`, `footer.delete_these_items`, "Delete now",
//    "Cancel") with the impact of the preview, focused on "Cancel" (FR-045);
// 4. the deletion with the preview's version: success announces legacy's
//    `success.mailbox_removed` (FR-046); an outdated deletion shows the impact again with a notice
//    (FR-044); a temporary failure says nothing was removed; an unknown outcome says so and
//    refreshes the list. One deletion runs at a time (FR-066).
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteMailbox, fetchDeletionPreview, forgetMailbox } from '../api'
import MailboxDeleteBlockers from '../components/delete/MailboxDeleteBlockers.vue'
import MailboxDeleteImpact from '../components/delete/MailboxDeleteImpact.vue'
import { deletionImpact, type DeletionImpact } from '../deletion'
import { readableAddress, type Mailbox } from '../types'

export type DeletionOutcome = 'deleted' | 'cancelled' | 'blocked' | 'gone' | 'failed' | 'unknown'

export function useMailboxDeletion(options: { onDeleted?: (message: string) => void } = {}) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const client = useQueryClient()
  const pending = ref(false)

  const inform = (title: string, description: string) =>
    confirm({ title, description, confirmLabel: t('common.close'), alertOnly: true })

  async function gone(mailbox: Mailbox): Promise<DeletionOutcome> {
    forgetMailbox(client, mailbox.address)
    await inform(lt('footer.confirm_delete'), t('mailboxes.delete.gone'))
    return 'gone'
  }

  async function preview(mailbox: Mailbox): Promise<DeletionImpact | DeletionOutcome> {
    try {
      return deletionImpact(await fetchDeletionPreview(client, mailbox.address))
    } catch (error) {
      const problem = problemOf(error)!
      if (problem.status === 404) return gone(mailbox)
      await inform(lt('footer.confirm_delete'), problemMessage(problem))
      return 'failed'
    }
  }

  async function run(mailbox: Mailbox): Promise<DeletionOutcome> {
    const readable = readableAddress(mailbox)
    const notDeleted = t('mailboxes.delete.notDeletedTitle', { name: readable })
    let notice: string | undefined
    for (;;) {
      const impact = await preview(mailbox)
      if (typeof impact === 'string') return impact
      if (!impact.canProceed) {
        const again = await confirm({
          title: lt('footer.confirm_delete'),
          content: { component: MailboxDeleteBlockers, props: { impact, readable } },
          confirmLabel: t('mailboxes.delete.checkAgain'),
          cancelLabel: lt('footer.cancel'),
        })
        if (again) continue
        return 'blocked'
      }
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        content: { component: MailboxDeleteImpact, props: { impact, readable, notice } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      try {
        await deleteMailbox(client, mailbox.address, impact.etag)
        const message = lt('success.mailbox_removed', readable)
        announce(message)
        options.onDeleted?.(message)
        return 'deleted'
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          notice = t('mailboxes.delete.changed')
          continue
        }
        if (problem.status === 404) return gone(mailbox)
        if (problem.status === 504) {
          void client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() })
          await inform(notDeleted, problemMessage(problem))
          return 'unknown'
        }
        await inform(notDeleted, `${t('domains.delete.notDeleted')} ${problemMessage(problem)}`)
        return 'failed'
      }
    }
  }

  async function start(mailbox: Mailbox): Promise<DeletionOutcome> {
    if (pending.value) return 'cancelled'
    pending.value = true
    try {
      return await run(mailbox)
    } finally {
      pending.value = false
    }
  }

  return { pending, start }
}
