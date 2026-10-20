// One action on an open quarantine item (UI 006 data-model §8 "Item action", research R14,
// FR-025 to FR-031). It asks where legacy or the resolved deviations ask, sends the action once
// with the item's version tag, and disables the controls while it runs. Then:
// - success: legacy's alerts go with the user back to the list (`onFinished`);
// - `404`: the item is gone; back to the list, which is refreshed (`onGone`);
// - busy: the message, and one re-read after `Retry-After` (5 s by default) through a single timer
//   that leaving the page or any new action cancels; gone → back to the list, otherwise the item
//   is available again;
// - refused delivery, `412` (the item is read again), `403` (the session reaction refreshes the
//   identity, so the controls follow the new flags): the message, and the item stays;
// - `503`: the message naming the service, and a retry the user starts;
// - no response: "outcome unknown" and one re-read of the item; gone → back to the list. The action
//   is never sent again by itself.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { problemOf, type QuarantineItem } from '@/api'
import { text } from '@/i18n'

import { deletedLines, reportLines, toProblemOutcome, type OutcomeLine } from '../action-outcome'
import { runItemAction, type ItemActionKind } from '../api'
import { askItemAction } from '../confirmations'
import { useBusyRecheck } from './useBusyRecheck'

type ActionItem = Pick<QuarantineItem, 'id' | 'etag' | 'subject' | 'sender' | 'virus'>

/** What a re-read found: the item, no item (`404`), or no answer. */
export type RereadResult = 'present' | 'gone' | 'failed'

export interface ItemActionOptions {
  item: () => ActionItem | undefined
  /** Route identity, when a successful mutation can remove the cached item before returning. */
  itemId?: () => number | undefined
  /** Reads the item again (once). */
  reread: () => Promise<RereadResult>
  /** The action is done: back to the list with its alerts. */
  onFinished: (lines: OutcomeLine[]) => void
  /** The item no longer exists: back to the list, which is refreshed. */
  onGone: (lines: OutcomeLine[]) => void
  ask?: (kind: ItemActionKind, item: ActionItem) => Promise<boolean>
}

export const goneLines = (): OutcomeLine[] => [{ kind: 'danger', text: text('problem.status.404') }]

export function useItemAction(options: ItemActionOptions) {
  const client = useQueryClient()
  const ask = options.ask ?? askItemAction
  const recheck = useBusyRecheck()
  const sending = ref(false)
  const confirming = ref(false)
  const lines = shallowRef<OutcomeLine[]>([])
  /** The action a temporary failure left for the user to retry. */
  const retryKind = ref<ItemActionKind | null>(null)
  const itemId = () => (options.itemId ? options.itemId() : options.item()?.id)
  let disposed = false
  let operation = 0

  function reset() {
    operation++
    recheck.cancel()
    sending.value = false
    confirming.value = false
    lines.value = []
    retryKind.value = null
  }
  watch(itemId, reset, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    reset()
  })

  async function rereadAfterBusy(current: () => boolean) {
    if (!current()) return
    const result = await options.reread()
    if (!current()) return
    if (result === 'gone') options.onGone(goneLines())
    else if (result === 'present') lines.value = []
  }

  async function run(kind: ItemActionKind) {
    const item = options.item()
    if (disposed || !item || item.id !== itemId() || sending.value || confirming.value) return
    const started = ++operation
    const current = () => !disposed && operation === started && itemId() === item.id
    recheck.cancel()
    confirming.value = true
    try {
      if (!(await ask(kind, item)) || !current()) return
    } finally {
      if (current()) confirming.value = false
    }
    sending.value = true
    retryKind.value = null
    lines.value = []
    try {
      const report = await runItemAction(client, kind, item)
      if (!current()) return
      options.onFinished(report ? reportLines(report) : deletedLines(item.id))
    } catch (error) {
      if (!current()) return
      const outcome = toProblemOutcome(problemOf(error)!)
      lines.value = outcome.lines
      if (outcome.follow === 'return') options.onGone(outcome.lines)
      else if (outcome.follow === 'recheck') {
        recheck.schedule(outcome.retryAfter ?? 5, () => rereadAfterBusy(current))
      } else if (outcome.follow === 'retry') retryKind.value = kind
      else if (outcome.follow === 'unknown') {
        if ((await options.reread()) === 'gone' && current()) options.onGone(outcome.lines)
      }
    } finally {
      if (current()) sending.value = false
    }
  }

  return {
    /** An action is being sent: its controls are disabled (FR-031). */
    sending,
    /** A busy item waits for its re-check. */
    waiting: recheck.pending,
    lines,
    retryKind,
    busy: computed(() => sending.value || confirming.value),
    run,
    retry: () => (retryKind.value ? run(retryKind.value) : Promise.resolve()),
    dismiss() {
      lines.value = []
      retryKind.value = null
    },
  }
}
