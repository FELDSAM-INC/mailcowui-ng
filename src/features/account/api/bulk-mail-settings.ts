import type { QueryClient } from '@tanstack/vue-query'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type Mailbox,
  type Readable,
  type MailboxMailSettingsBulkActionRequest,
} from '@/api'

export function mailSettingsBulkRequest(
  direction: 'inbound' | 'outbound',
  enabled: boolean,
  mailboxes: readonly Pick<Readable<Mailbox>, 'address' | 'mailSettingsVersion'>[],
): MailboxMailSettingsBulkActionRequest {
  return {
    action: 'setTlsEnforcement',
    ...(direction === 'inbound' ? { tlsEnforceInbound: enabled } : { tlsEnforceOutbound: enabled }),
    targets: mailboxes.map((mailbox) => ({
      id: mailbox.address,
      version: mailbox.mailSettingsVersion,
    })),
  }
}
export function applyMailboxMailSettingsBulk(
  client: QueryClient,
  body: MailboxMailSettingsBulkActionRequest,
) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(await api.POST('/mailboxes/mail-settings/bulk-actions', { body })).data,
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: queryKeys.mailboxes.all() })
        void client.invalidateQueries({ queryKey: queryKeys.selfService.all() })
        void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}
