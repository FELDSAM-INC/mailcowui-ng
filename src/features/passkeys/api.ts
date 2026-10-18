// Own passkeys (T106, data-model §3): the list (newest first), registration, rename and removal.
// Rename and removal send the version tag that was read (`If-Match`); the callers use
// useVersionedSave for the 412 path.
import { queryOptions } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  type Passkey,
  type PasskeyListParams,
  type PasskeyRegistrationOptions,
  type PasskeyRegistrationRequest,
  type Writable,
} from '@/api'

/** FR-052: the newest passkey comes first. */
export const PASSKEY_ORDER = { sort: 'registeredAt', order: 'desc' } as const

export function passkeysListQuery(page: { limit: number; offset: number }) {
  const params: PasskeyListParams = { ...page, ...PASSKEY_ORDER }
  return queryOptions({
    queryKey: queryKeys.passkeys.list(params),
    queryFn: async () => requireData(await api.GET('/me/passkeys', { params: { query: params } })),
  })
}

export async function createRegistrationOptions(): Promise<PasskeyRegistrationOptions> {
  return requireData(await api.POST('/me/passkeys/registration-options')).data
}

export async function registerPasskey(
  body: Writable<PasskeyRegistrationRequest>,
): Promise<Passkey> {
  return requireData(await api.POST('/me/passkeys', { body })).data
}

export async function renamePasskey(id: string, name: string, ifMatch: string): Promise<Passkey> {
  const result = await api.PATCH('/me/passkeys/{passkeyId}', {
    params: { path: { passkeyId: id }, header: { 'If-Match': ifMatch } },
    headers: { 'Content-Type': 'application/merge-patch+json' },
    body: { name },
  })
  return requireData(result).data
}

export async function removePasskey(id: string, ifMatch: string): Promise<void> {
  await api.DELETE('/me/passkeys/{passkeyId}', {
    params: { path: { passkeyId: id }, header: { 'If-Match': ifMatch } },
  })
}
