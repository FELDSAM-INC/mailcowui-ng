// Shared by mailbox and administrator password forms. Policy checks guide input; the API decides.
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { api, queryKeys, requireData } from '@/api'
export function passwordPolicyOptions() {
  return queryOptions({
    queryKey: queryKeys.passwordPolicy(),
    queryFn: async () => requireData(await api.GET('/password-policy')).data,
    staleTime: 0,
    refetchOnMount: 'always' as const,
  })
}
export function usePasswordPolicy() {
  return useQuery(passwordPolicyOptions())
}
