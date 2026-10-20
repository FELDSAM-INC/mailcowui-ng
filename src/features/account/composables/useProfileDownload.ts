import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { queryKeys, type AppleProfileRequest } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { parseContentDisposition, sanitiseFileName, saveBlob } from '@/shared/platform/download'
import { fetchAppleProfile } from '../api/client-setup'

export function useProfileDownload(mailbox: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  const request = useSecretRequest(fetchAppleProfile)
  const createdAppPassword = ref(false)
  const flagWithdrawn = ref(false)
  const groupwareWithdrawn = ref(false)
  async function download(variant: AppleProfileRequest['variant'], withAppPassword: boolean) {
    if (request.pending.value || (withAppPassword && flagWithdrawn.value)) return
    const owner = toValue(mailbox)
    const value = await request.run(variant, withAppPassword)
    if (!value) {
      if (request.problem.value?.type === '/api/v2/problems/permission-flag-required')
        flagWithdrawn.value = true
      if (request.problem.value?.type === '/api/v2/problems/groupware-disabled') {
        groupwareWithdrawn.value = true
        void client.invalidateQueries({ queryKey: queryKeys.capabilities.selfService() })
        void client.invalidateQueries({ queryKey: queryKeys.me.clientConfiguration() })
      }
      return
    }
    // Forget the Blob before dispatching a download, including if the browser refuses to save.
    request.clear()
    if (withAppPassword) {
      createdAppPassword.value = true
      void client.invalidateQueries({ queryKey: queryKeys.selfService.appPasswords(owner) })
      void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
      void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
    }
    if (value.data) {
      const name = sanitiseFileName(
        parseContentDisposition(value.response.headers.get('content-disposition')) ??
          'profile.mobileconfig',
        'profile.mobileconfig',
      )
      saveBlob(value.data, name)
    }
  }
  return {
    download,
    pending: request.pending,
    problem: computed(() => request.problem.value),
    createdAppPassword,
    flagWithdrawn,
    groupwareWithdrawn,
  }
}
