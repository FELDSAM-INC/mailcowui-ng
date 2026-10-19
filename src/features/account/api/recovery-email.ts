// The recovery address (UI 005 data-model §3, research R13): the read as a query; the replacement
// carries the current password, so the caller runs it through `useSecretRequest`, then writes the
// answer into the cache and invalidates the overview.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  type OwnRecoveryEmail,
  type OwnRecoveryEmailReplacement,
  type Writable,
} from '@/api'

export async function fetchOwnRecoveryEmail(): Promise<OwnRecoveryEmail> {
  return requireData(await api.GET('/me/recovery-email')).data
}

export function ownRecoveryEmailOptions() {
  return queryOptions({
    queryKey: queryKeys.me.recoveryEmail(),
    queryFn: fetchOwnRecoveryEmail,
    staleTime: 30_000,
  })
}

export function useOwnRecoveryEmail() {
  return useQuery(ownRecoveryEmailOptions())
}

/** Replaces the recovery address. Use through `useSecretRequest`: it carries the password. */
export async function replaceOwnRecoveryEmail(
  body: Writable<OwnRecoveryEmailReplacement>,
  etag: string,
): Promise<OwnRecoveryEmail> {
  return requireData(
    await api.PUT('/me/recovery-email', { body, params: { header: { 'If-Match': etag } } }),
  ).data
}

export function afterRecoveryEmailChange(client: QueryClient, value: OwnRecoveryEmail): void {
  client.setQueryData(queryKeys.me.recoveryEmail(), value)
  void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
}
