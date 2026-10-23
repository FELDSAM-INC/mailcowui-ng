// Each feature retains its generated bulk request and cache invalidation rules.
import { queryKeys, type DomainTemplate } from '@/api'
import type { BulkSelection } from '@/shared/composables/useBulkSelection'
import { useTemplateBulkDelete as useSharedTemplateBulkDelete } from '@/shared/composables/useTemplateBulkDelete'

import { applyTemplateBulkAction } from '../templates-api'

export function useTemplateBulkDelete(options: {
  selection: BulkSelection
  entries: () => readonly DomainTemplate[]
}) {
  return useSharedTemplateBulkDelete(options, {
    listsKey: queryKeys.domainTemplates.lists(),
    deleteTemplates: (client, targets) =>
      applyTemplateBulkAction(client, { action: 'delete', targets }),
    keepValuesKey: 'domainTemplates.delete.keepValues',
  })
}
