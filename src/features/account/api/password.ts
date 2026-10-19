// The own password (UI 005 data-model §3, research R7, R13): the policy as a query (also in a
// session restricted by a forced change), and the change as a direct client call that the caller
// runs through `useSecretRequest`, because it carries passwords. After a change the overview (its
// password-changed time) is invalidated.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  type OwnPasswordChangeRequest,
  type OwnPasswordChangeResult,
  type PasswordPolicy,
  type Writable,
} from '@/api'

export async function fetchOwnPasswordPolicy(): Promise<PasswordPolicy> {
  return requireData(await api.GET('/me/password-policy')).data
}

export function ownPasswordPolicyOptions() {
  return queryOptions({
    queryKey: queryKeys.me.passwordPolicy(),
    queryFn: fetchOwnPasswordPolicy,
    staleTime: 30_000,
  })
}

export function useOwnPasswordPolicy() {
  return useQuery(ownPasswordPolicyOptions())
}

/** Changes the own password. Use it through `useSecretRequest` only. */
export async function changeOwnPassword(
  body: Writable<OwnPasswordChangeRequest>,
): Promise<OwnPasswordChangeResult> {
  return requireData(await api.PUT('/me/password', { body })).data
}

export function afterOwnPasswordChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
}
