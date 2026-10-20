import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type PasswordPolicyPatch } from '@/api'

export function passwordPolicyOptions() {
  return queryOptions({
    queryKey: queryKeys.passwordPolicy(),
    queryFn: async ({ signal }) => requireData(await api.GET('/password-policy', { signal })).data,
    staleTime: 30_000,
  })
}
export const usePasswordPolicy = () => useQuery(passwordPolicyOptions())

export async function updatePasswordPolicy(body: PasswordPolicyPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/password-policy', {
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
      body,
    }),
  ).data
}
