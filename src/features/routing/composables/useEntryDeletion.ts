// Deleting one routing entry from its list (conventions "Confirmations", FR-017, FR-018): legacy's
// `#ConfirmDeleteModal` texts naming the entry (with the relayhost's usage as impact), the
// deletion with the entry's version tag, legacy's success message announced. An outdated deletion
// reloads the entry and asks again; an entry that is gone, and other refusals, are explained with
// nothing deleted.
import { ref, type Component } from 'vue'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import EntryNameList from '../components/common/EntryNameList.vue'

export interface EntryDeletionSpec<T> {
  nameOf: (entry: T) => string
  impact?: (entry: T) => { component: Component; props?: Record<string, unknown> }
  remove: (entry: T) => Promise<void>
  /** Reloads the entry after a 412; undefined when it is gone. */
  reload: (entry: T) => Promise<T | undefined>
  /** Legacy's success message of the deletion. */
  success: (entry: T) => string
}

export type DeletionOutcome = 'deleted' | 'cancelled' | 'gone' | 'failed'

export function useEntryDeletion<T>(spec: EntryDeletionSpec<T>) {
  const { problemMessage } = useProblemMessages()
  const pending = ref(false)

  const inform = (description: string) =>
    confirm({
      title: lt('footer.confirm_delete'),
      description,
      confirmLabel: lt('footer.cancel'),
      alertOnly: true,
    })

  async function start(initial: T): Promise<DeletionOutcome> {
    if (pending.value) return 'cancelled'
    let entry = initial
    let notice: string | undefined
    for (;;) {
      const confirmed = await confirm({
        title: lt('footer.confirm_delete'),
        description: notice ?? lt('footer.delete_these_items'),
        content: spec.impact?.(entry) ?? {
          component: EntryNameList,
          props: { names: [spec.nameOf(entry)] },
        },
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
      if (!confirmed) return 'cancelled'
      pending.value = true
      try {
        await spec.remove(entry)
        announce(spec.success(entry))
        return 'deleted'
      } catch (error) {
        const problem = problemOf(error)!
        if (problem.status === 412) {
          const latest = await spec.reload(entry).catch(() => undefined)
          if (latest) {
            entry = latest
            notice = problemMessage(problem)
            continue
          }
        }
        await inform(problemMessage(problem))
        return problem.status === 404 || problem.status === 412 ? 'gone' : 'failed'
      } finally {
        pending.value = false
      }
    }
  }

  return { start, pending }
}
