// "Remove hash" of the rate-limited log (plan decisions 16 and 26): legacy's #ConfirmDeleteModal
// (`footer.confirm_delete`, `footer.delete_these_items` with the hash, `footer.delete_now`,
// `footer.cancel`), then `DELETE /rate-limit-buckets/{bucketId}` (API 006) and legacy's outcome as a
// status message: `success.hash_deleted`, or `warning.hash_not_found` when there was nothing to
// reset. Both outcomes refresh the log; any other problem says that nothing was changed.
import { markRaw, ref } from 'vue'

import { api, problemOf, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import { confirm } from '@/shared/composables/useConfirm'
import { pushStatusMessage } from '@/shared/composables/useStatusMessage'

import ResetHashContent from './components/ResetHashContent.vue'

export function useRateLimitReset(options: { refresh: () => Promise<unknown> }) {
  const problem = ref<ApiProblem | null>(null)
  const pending = ref(false)

  async function reset(hash: string): Promise<void> {
    const confirmed = await confirm({
      title: lt('footer.confirm_delete'),
      description: lt('footer.delete_these_items'),
      content: { component: markRaw(ResetHashContent), props: { items: [hash] } },
      confirmLabel: lt('footer.delete_now'),
      cancelLabel: lt('footer.cancel'),
      destructive: true,
    })
    if (!confirmed) return
    problem.value = null
    pending.value = true
    try {
      await api.DELETE('/rate-limit-buckets/{bucketId}', {
        params: { path: { bucketId: hash } },
      })
      pushStatusMessage({ text: lt('success.hash_deleted'), tone: 'success' })
      await options.refresh()
    } catch (error) {
      const failure = problemOf(error)
      if (failure?.status === 404) {
        pushStatusMessage({ text: lt('warning.hash_not_found'), tone: 'warning' })
        await options.refresh()
      } else {
        problem.value = failure
      }
    } finally {
      pending.value = false
    }
  }

  return { reset, problem, pending }
}
