// Direct call: the hand-off grants a browser session and must not enter a mutation cache.
import { api, requireData, type WebmailHandOff } from '@/api'
import { safeHref } from '@/shared/security/safe-url'

export async function createWebmailHandOff(): Promise<WebmailHandOff> {
  return requireData(await api.POST('/me/webmail-handoff')).data
}

/** The hand-off only grants this host's webmail. Never navigate to an external origin. */
export function webmailPath(value: string): string {
  const href = safeHref(value)
  if (!href?.startsWith('/')) throw new Error('Invalid webmail hand-off address')
  return href
}
