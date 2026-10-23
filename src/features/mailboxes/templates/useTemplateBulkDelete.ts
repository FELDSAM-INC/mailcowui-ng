// Each feature retains its generated bulk request and cache invalidation rules.
import { queryKeys } from '@/api'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { useTemplateBulkDelete as useSharedTemplateBulkDelete } from '@/shared/composables/useTemplateBulkDelete'

import { deleteTemplates } from '../templates-api'
import type { MailboxTemplate } from '../types'

export function useTemplateBulkDelete(options: {
  selection: BulkSelection
  entries: () => readonly MailboxTemplate[]
}) {
  return useSharedTemplateBulkDelete(options, {
    listsKey: queryKeys.mailboxTemplates.lists(),
    deleteTemplates: (client, targets) => deleteTemplates(client, { action: 'delete', targets }),
    keepValuesKey: 'mailboxTemplates.delete.keepValues',
  })
}
