import type { QueryClient } from '@tanstack/vue-query'
import { api, queryKeys, runMutation } from '@/api'

function reset(
  client: QueryClient,
  mailbox: string,
  kind: 'activesync-cache' | 'groupware-profile',
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        const path =
          kind === 'activesync-cache'
            ? ('/mailboxes/{mailbox}/activesync-cache' as const)
            : ('/mailboxes/{mailbox}/groupware-profile' as const)
        await api.DELETE(path, { params: { path: { mailbox } } })
      },
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}
export const resetActiveSyncCache = (client: QueryClient, mailbox: string) =>
  reset(client, mailbox, 'activesync-cache')
export const resetGroupwareProfile = (client: QueryClient, mailbox: string) =>
  reset(client, mailbox, 'groupware-profile')
