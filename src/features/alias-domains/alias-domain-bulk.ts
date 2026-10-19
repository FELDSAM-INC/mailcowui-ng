// The domain alias mass actions (research R16, US6-AS7): activate, deactivate (one confirmation)
// and delete (the typed count), with legacy's labels. None of them needs `aliasDomains`.
import type { AliasDomainBulkActionRequest } from '@/api'
import type { BulkActionConfig } from '@/features/aliases'

export type AliasDomainBulkAction = AliasDomainBulkActionRequest['action']

export function aliasDomainBulkActions(): BulkActionConfig<AliasDomainBulkAction>[] {
  return [
    { action: 'activate', labelKey: 'mailbox.activate', confirm: 'none' },
    { action: 'deactivate', labelKey: 'mailbox.deactivate', confirm: 'simple' },
    { action: 'delete', labelKey: 'mailbox.remove', confirm: 'typedCount', destructive: true },
  ]
}
