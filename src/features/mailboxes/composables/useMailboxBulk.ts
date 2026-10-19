// Mass actions on the selected mailboxes (US6, data-model §7.4, conventions "Bulk actions"): one
// request with the API's bulk operation and each mailbox's version tag. Activating needs no
// confirmation; deactivating, disallowing login or a protocol need one; deleting needs the number
// typed (FR-055). The result has one row per mailbox; failed, refused and outdated mailboxes stay
// selected for a retry with the refreshed list's version tags, which repeats the confirmed action
// without asking again (FR-056). A whole-request refusal is one message with the selection kept;
// a lost connection reports every mailbox as "outcome unknown", clears the selection and retries
// nothing. One request at a time (FR-066).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, queryKeys, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import {
  isRetryable,
  rowsFromBulkResult,
  unknownRows,
  type BulkRow,
} from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { confirm } from '@/shared/composables/useConfirm'

import { applyMailboxBulk } from '../api'
import {
  bulkEntries,
  bulkRequest,
  confirmationOf,
  protocolHeader,
  type MailboxBulkChoice,
} from '../bulk'
import MailboxBulkConfirm from '../components/list/MailboxBulkConfirm.vue'
import { readableAddress, type Mailbox } from '../types'

export function useMailboxBulk(options: {
  selection: BulkSelection
  entries: () => readonly Mailbox[]
}) {
  const { t } = useI18n()
  const client = useQueryClient()
  const phase = ref<'idle' | 'running' | 'results'>('idle')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  let last: MailboxBulkChoice | null = null

  function ask(choice: MailboxBulkChoice, mailboxes: readonly Mailbox[]): Promise<boolean> {
    const count = mailboxes.length
    const addresses = mailboxes.map(readableAddress)
    const kind = confirmationOf(choice)
    if (kind === 'none') return Promise.resolve(true)
    if (kind === 'typed') {
      return confirm({
        title: lt('footer.confirm_delete'),
        content: { component: MailboxBulkConfirm, props: { addresses } },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
        requireTyped: {
          accepted: [String(count)],
          labelKey: 'bulk.confirm.typeCount',
          labelParams: { count },
        },
      })
    }
    const protocol = 'protocol' in choice ? protocolHeader(choice.protocol) : ''
    const key =
      choice.action === 'deactivate'
        ? 'deactivate'
        : choice.action === 'disableLogin'
          ? 'disableLogin'
          : 'disallowProtocol'
    return confirm({
      title: t(`mailboxes.bulk.${key}Title`, { count, protocol }),
      content: {
        component: MailboxBulkConfirm,
        props: { addresses, effect: t(`mailboxes.bulk.${key}Effect`, { protocol }) },
      },
      confirmLabel: lt(key === 'disableLogin' ? 'mailbox.disable_login' : 'mailbox.deactivate'),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
  }

  async function run(choice: MailboxBulkChoice, retrying = false) {
    if (phase.value === 'running') return
    if (retrying) {
      await client.refetchQueries(
        { queryKey: queryKeys.mailboxes.lists(), type: 'active', stale: true },
        { cancelRefetch: false },
      )
    }
    const ids = options.selection.ids.value
    const mailboxes = options.entries().filter((mailbox) => ids.has(mailbox.address))
    if (mailboxes.length === 0) return
    if (!retrying && !(await ask(choice, mailboxes))) return
    last = choice
    problem.value = null
    phase.value = 'running'
    running.value = mailboxes.length
    announce(t('bulk.progress', { count: mailboxes.length }))
    try {
      const result = await applyMailboxBulk(client, bulkRequest(choice, mailboxes))
      rows.value = rowsFromBulkResult(result, bulkEntries(mailboxes))
      options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.kind === 'network') {
        rows.value = unknownRows(bulkEntries(mailboxes))
        options.selection.clear()
      } else {
        rows.value = []
        problem.value = failure
      }
    } finally {
      running.value = 0
    }
    phase.value = 'results'
  }

  return {
    phase,
    rows,
    running,
    problem,
    canRetry: computed(() => rows.value.some(isRetryable) && options.selection.count.value > 0),
    run: (choice: MailboxBulkChoice) => run(choice),
    retry: () => (last ? run(last, true) : Promise.resolve()),
    close() {
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}
