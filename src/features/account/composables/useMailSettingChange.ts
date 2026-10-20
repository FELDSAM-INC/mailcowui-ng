import { useQueryClient } from '@tanstack/vue-query'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  type ApiProblem,
  type MailboxMailSettings,
  type MailboxMailSettingsPatch,
} from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { updateMailSettings } from '../api/mail-settings'

/** One immediate setting change. Conflicts reload; no mutation is automatically retried. */
export function useMailSettingChange(options: {
  stored: () => MailboxMailSettings
  canChange: () => boolean
  reload: () => Promise<unknown>
}) {
  const client = useQueryClient()
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const pending = ref(false)
  const outdated = ref(false)
  const notice = ref('')
  const problem = shallowRef<ApiProblem | null>(null)
  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })
  async function save(patch: MailboxMailSettingsPatch) {
    if (disposed || pending.value || !options.canChange()) return
    const stored = options.stored()
    pending.value = true
    notice.value = ''
    problem.value = null
    outdated.value = false
    try {
      await updateMailSettings(client, stored.mailbox, patch, stored.etag)
      if (disposed || options.stored().mailbox !== stored.mailbox) return
      notice.value = lt('success.mailbox_modified', stored.mailbox)
      announce(notice.value)
    } catch (error) {
      if (disposed || options.stored().mailbox !== stored.mailbox) return
      const found = problemOf(error)
      if (found?.status === 412) {
        outdated.value = true
        try {
          await options.reload()
          if (!disposed) announce(t('account.mailSettings.changedElsewhere'), { assertive: true })
        } catch (reloadError) {
          if (!disposed) problem.value = problemOf(reloadError)
        }
      } else {
        problem.value = found
        if (found) announce(problemMessage(found), { assertive: true })
      }
    } finally {
      if (!disposed) pending.value = false
    }
  }
  return { pending, outdated, notice, problem, save }
}
