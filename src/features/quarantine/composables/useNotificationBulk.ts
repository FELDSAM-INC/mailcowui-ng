// The quarantine notification mass action on UI 003's selected mailboxes (UI 006 US3, FR-041,
// legacy form map screens 4 and part 2, D21): the bulk confirmation (title
// `mailbox.quarantine_notification` or `mailbox.quarantine_category`, the chosen option,
// `bulk.selected`, `quarantine.confirm` and `footer.cancel`), one request with every mailbox as a
// target without version (research R16), and one result row per mailbox under UI 003's selection
// rules: done mailboxes say legacy's `success.mailbox_modified`; failed, refused and outdated ones
// stay selected for a retry, which repeats the confirmed choice without asking again. A
// whole-request refusal is one message with the selection kept; a lost connection reports every
// mailbox as "outcome unknown", clears the selection and retries nothing.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem } from '@/api'
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

import NotificationBulkConfirm from '../components/notifications/NotificationBulkConfirm.vue'
import {
  notificationBulkOption,
  notificationBulkRequest,
  notificationBulkTitleKey,
  type NotificationBulkChoice,
} from '../notification-bulk'
import { applyNotificationBulk } from '../notifications-api'

export interface NotificationBulkEntry {
  /** The mailbox address (the target). */
  address: string
}

export interface NotificationBulkOptions<E extends NotificationBulkEntry> {
  selection: BulkSelection
  /** The mailboxes of the current page. */
  entries: () => readonly E[]
  /** The readable address of a mailbox (UI 003's `readableAddress`). */
  label?: (entry: E) => string
  /** Refreshes the list before a retry, so that its result reflects the current state. */
  refresh?: () => Promise<unknown>
}

export function useNotificationBulk<E extends NotificationBulkEntry>(
  options: NotificationBulkOptions<E>,
) {
  const { t } = useI18n()
  const client = useQueryClient()
  const phase = ref<'idle' | 'confirming' | 'running' | 'results'>('idle')
  const busy = computed(() => phase.value === 'confirming' || phase.value === 'running')
  const rows = shallowRef<BulkRow[]>([])
  const running = ref(0)
  const problem = shallowRef<ApiProblem | null>(null)
  const labelOf = (entry: E) => options.label?.(entry) ?? entry.address
  let last: NotificationBulkChoice | null = null

  function ask(choice: NotificationBulkChoice, mailboxes: readonly E[]): Promise<boolean> {
    return confirm({
      title: lt(notificationBulkTitleKey(choice)),
      content: {
        component: NotificationBulkConfirm,
        props: {
          value: lt(notificationBulkOption(choice).labelKey),
          addresses: mailboxes.map(labelOf),
        },
      },
      confirmLabel: lt('quarantine.confirm'),
      cancelLabel: lt('footer.cancel'),
    })
  }

  async function run(choice: NotificationBulkChoice, retrying = false) {
    if (busy.value) return
    const previousPhase = phase.value
    const retryIds = new Set(rows.value.filter(isRetryable).map((row) => row.id))
    if (retrying && ![...retryIds].some((id) => options.selection.isSelected(id))) return
    phase.value = 'confirming'
    try {
      if (retrying) await options.refresh?.()
      const mailboxes = options
        .entries()
        .filter(
          (entry) =>
            options.selection.isSelected(entry.address) &&
            (!retrying || retryIds.has(entry.address)),
        )
      if (mailboxes.length === 0 || (!retrying && !(await ask(choice, mailboxes)))) {
        phase.value = previousPhase
        return
      }
      if (mailboxes.some((entry) => !options.selection.isSelected(entry.address))) {
        phase.value = previousPhase
        return
      }
      last = choice
      problem.value = null
      phase.value = 'running'
      running.value = mailboxes.length
      announce(t('bulk.progress', { count: mailboxes.length }))
      const entries = mailboxes.map((entry) => ({
        name: entry.address,
        unicodeName: labelOf(entry),
      }))
      try {
        const result = await applyNotificationBulk(
          client,
          notificationBulkRequest(
            choice,
            mailboxes.map((entry) => entry.address),
          ),
        )
        rows.value = rowsFromBulkResult(result, entries)
        options.selection.keep(rows.value.filter(isRetryable).map((row) => row.id))
      } catch (error) {
        const failure = problemOf(error)!
        if (failure.kind === 'network') {
          rows.value = unknownRows(entries)
          options.selection.clear()
          // A lost answer may have followed a successful write. Re-read without resending it.
          await options.refresh?.().catch(() => undefined)
        } else {
          rows.value = []
          problem.value = failure
        }
      }
      phase.value = 'results'
    } finally {
      running.value = 0
      if (phase.value === 'confirming') phase.value = previousPhase
    }
  }

  return {
    phase,
    busy,
    rows,
    running,
    problem,
    canRetry: computed(() =>
      rows.value.some((row) => isRetryable(row) && options.selection.isSelected(row.id)),
    ),
    /** Legacy's message of a done mailbox; other rows show their problem. */
    message: (row: BulkRow) =>
      row.outcome === 'done' ? lt('success.mailbox_modified', row.id) : null,
    run: (choice: NotificationBulkChoice) => run(choice),
    retry: () => (last ? run(last, true) : Promise.resolve()),
    close() {
      if (busy.value) return
      phase.value = 'idle'
      rows.value = []
      problem.value = null
    },
  }
}

export type NotificationBulk = ReturnType<typeof useNotificationBulk>
