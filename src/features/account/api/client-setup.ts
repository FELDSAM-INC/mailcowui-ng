import { useQuery } from '@tanstack/vue-query'
import {
  api,
  queryKeys,
  requireData,
  type AppleProfileRequest,
  type MailboxClientConfiguration,
} from '@/api'

export function useClientConfiguration() {
  return useQuery({
    queryKey: queryKeys.me.clientConfiguration(),
    queryFn: async (): Promise<MailboxClientConfiguration> =>
      requireData(await api.GET('/me/mailbox/client-configuration')).data,
    staleTime: 300_000,
  })
}
/** Profiles may contain a generated password. Only call through useSecretRequest. */
export function fetchAppleProfile(
  variant: AppleProfileRequest['variant'],
  withAppPassword: boolean,
) {
  return withAppPassword
    ? api.POST('/me/mailbox/apple-profile', { body: { variant }, parseAs: 'blob' })
    : api.GET('/me/mailbox/apple-profile', { params: { query: { variant } }, parseAs: 'blob' })
}
