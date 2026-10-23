// Keep the feature's API/cache boundary and destination explicit; share the deletion lifecycle.
import { queryKeys } from '@/api'
import { useTemplateDeletion as useSharedTemplateDeletion } from '@/shared/composables/useTemplateDeletion'

import { deleteTemplate, fetchTemplate } from '../templates-api'

export type { TemplateDeletionOutcome } from '@/shared/composables/useTemplateDeletion'

export function useTemplateDeletion() {
  return useSharedTemplateDeletion({
    deleteTemplate,
    fetchTemplate,
    detailKey: queryKeys.mailboxTemplates.detail,
    listRoute: 'mailbox-templates',
    keepValuesKey: 'mailboxTemplates.delete.keepValues',
  })
}
