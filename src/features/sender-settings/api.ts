// The sender settings of a mailbox (data-model §3): one read per mailbox, the save of the changed
// sets with `If-Match`, and the grantable entries searched by the server (FR-050).
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type MailboxSenderPermissionCandidate,
  type MailboxSenderSettings,
  type MailboxSenderSettingsPatch,
  type SenderPermissionCandidateParams,
} from '@/api'

export async function fetchSenderSettings(mailbox: string): Promise<MailboxSenderSettings> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/sender-settings', { params: { path: { mailbox } } }),
  ).data
}

export function senderSettingsOptions(mailbox: string) {
  return queryOptions({
    queryKey: queryKeys.senderSettings.detail(mailbox),
    queryFn: () => fetchSenderSettings(mailbox),
    staleTime: 30_000,
  })
}

export function updateSenderSettings(
  client: QueryClient,
  mailbox: string,
  patch: MailboxSenderSettingsPatch,
  ifMatch: string,
): Promise<MailboxSenderSettings> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/mailboxes/{mailbox}/sender-settings', {
            params: { path: { mailbox }, header: { 'If-Match': ifMatch } },
            body: patch,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: (settings) => {
        client.setQueryData(queryKeys.senderSettings.detail(mailbox), settings)
        void client.invalidateQueries({ queryKey: ['sender-permission-candidates'] })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}

export interface CandidatePage {
  items: MailboxSenderPermissionCandidate[]
  total: number
}

export async function fetchCandidates(
  params: SenderPermissionCandidateParams,
): Promise<CandidatePage> {
  const page = requireData(
    await api.GET('/sender-permission-candidates', { params: { query: params } }),
  )
  return { items: page.data, total: page.meta.total }
}
