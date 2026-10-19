// The queue actions (FR-054 to FR-060, research R14, data-model §7 "Queue action"): deliver,
// hold, release and delete on the selected messages in one request, flush, and delete all. Each is
// sent once and never repeated. The outcome is shown as legacy shows it (`success.queue_command_
// success`) with the result per message; a timeout or a lost connection is "outcome unknown"; a
// stopped Postfix names its container; a refused action shows Postfix's message. The list is read
// again after every action, whatever its outcome.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'

import { ApiProblem, isApiProblem, type MailQueueMessage } from '@/api'
import { lt } from '@/i18n'
import { rowsFromBulkResult, unknownRows, type BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'

import {
  flushMailQueue,
  purgeMailQueue,
  refreshQueue,
  runQueueAction,
  type QueueAction,
  type Recorded,
} from '../api'

export function useQueueActions() {
  const client = useQueryClient()
  const running = ref(false)
  /** The success message of the last action (legacy's alert). */
  const status = ref<string | null>(null)
  const rows = shallowRef<BulkRow[]>([])
  const problem = shallowRef<ApiProblem | null>(null)
  /** The action timed out or the connection was lost: it may or may not have happened. */
  const unknown = ref(false)
  /** The action was carried out without an audit record (`Audit-Recorded: false`). */
  const notRecorded = ref(false)
  /** The Postfix container the API reports as not running. */
  const stoppedContainer = ref<string | null>(null)

  function reset() {
    status.value = null
    rows.value = []
    problem.value = null
    unknown.value = false
    notRecorded.value = false
    stoppedContainer.value = null
  }

  function fail(error: unknown, ids: readonly string[]) {
    const current = isApiProblem(error)
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
    if (!current.auditRecorded) notRecorded.value = true
    if (current.kind === 'network' || current.is('outcome-unknown')) {
      unknown.value = true
      rows.value = unknownRows(ids.map((id) => ({ name: id, unicodeName: id })))
      problem.value = current.kind === 'network' ? null : current
      return
    }
    if (current.is('mail-service-not-running')) {
      const container = current.extensions.container
      stoppedContainer.value = typeof container === 'string' ? container : null
    }
    problem.value = current
  }

  async function perform<T>(
    send: () => Promise<Recorded<T>>,
    ids: readonly string[],
    done: (result: T) => void,
  ): Promise<boolean> {
    reset()
    running.value = true
    try {
      const { result, auditRecorded } = await send()
      notRecorded.value = !auditRecorded
      status.value = lt('success.queue_command_success')
      done(result)
      announce(status.value)
      return true
    } catch (error) {
      fail(error, ids)
      return false
    } finally {
      running.value = false
      void refreshQueue(client)
    }
  }

  return {
    running,
    status,
    rows,
    problem,
    unknown,
    notRecorded,
    stoppedContainer,
    close: reset,
    /** One request for the selected messages (FR-054). */
    run(action: QueueAction, messages: readonly MailQueueMessage[]) {
      const ids = messages.map((message) => message.id)
      return perform(
        () => runQueueAction(action, ids),
        ids,
        (result) => {
          rows.value = rowsFromBulkResult(
            result,
            ids.map((id) => ({ name: id, unicodeName: id })),
          )
        },
      )
    },
    flush: () => perform(flushMailQueue, [], () => {}),
    purge: () => perform(purgeMailQueue, [], () => {}),
  }
}
