import { api, type RspamdUiPasswordRequest, type Writable } from '@/api'

// Secrets are handed directly to the client. No query or mutation cache holds this request.
export async function setRspamdUiPassword(body: Writable<RspamdUiPasswordRequest>): Promise<true> {
  await api.PUT('/settings/rspamd-ui-password', { body })
  return true
}
