import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import { createWebmailHandOff, webmailPath } from '../api/webmail'

/** Reserve the tab inside the click event; the asynchronous API call may then navigate it. */
export function useWebmailHandOff(
  enabled: MaybeRefOrGetter<boolean>,
  account: MaybeRefOrGetter<string>,
  onOpened: () => void = () => undefined,
) {
  const blockedUrl = ref<string | null>(null)
  let tab: Window | null = null
  let disposed = false
  let generation = 0
  const request = useSecretRequest(async () => {
    const result = await createWebmailHandOff()
    if (result.mailbox !== toValue(account)) throw new Error('Mailbox changed during hand-off')
    return webmailPath(result.url)
  })

  function cancel() {
    generation += 1
    tab?.close()
    tab = null
    blockedUrl.value = null
    request.clear()
  }
  watch([() => toValue(enabled), () => toValue(account)], cancel, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    cancel()
  })

  async function open() {
    if (disposed || request.pending.value || !toValue(enabled)) return
    blockedUrl.value = null
    const current = ++generation
    tab = window.open('', '_blank')
    // Do this before the request: a new document must never retain an opener.
    if (tab) tab.opener = null
    const url = await request.run()
    if (disposed || current !== generation || !toValue(enabled)) {
      request.clear()
      return
    }
    if (!url) {
      tab?.close()
      tab = null
      return
    }
    if (tab) {
      tab.location.replace(url)
      tab = null
    } else {
      blockedUrl.value = url
    }
    onOpened()
    request.clear()
  }

  return { open, blockedUrl, pending: request.pending, problem: request.problem }
}
