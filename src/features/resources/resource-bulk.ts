// The resource mass actions (research R16): activate, deactivate (one confirmation) and delete
// (the typed count), with legacy's labels.
import type { ResourceBulkActionRequest } from '@/api'
import type { BulkActionConfig } from '@/features/aliases-common'

export type ResourceBulkAction = ResourceBulkActionRequest['action']

export function resourceBulkActions(): BulkActionConfig<ResourceBulkAction>[] {
  return [
    { action: 'activate', labelKey: 'mailbox.activate', confirm: 'none' },
    { action: 'deactivate', labelKey: 'mailbox.deactivate', confirm: 'simple' },
    { action: 'delete', labelKey: 'mailbox.remove', confirm: 'typedCount', destructive: true },
  ]
}
