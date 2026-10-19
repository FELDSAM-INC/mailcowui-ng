import type { QuarantineItem } from '@/api'
import { lt, text } from '@/i18n'
import { confirm } from '@/shared/composables/useConfirm'

import type { ItemActionKind } from './api'
import QuarantineBulkConfirm from './components/bulk/QuarantineBulkConfirm.vue'

/** Every bulk action is confirmed; destructive actions also require the target count. */
export function askQuarantineBulk(action: ItemActionKind, items: readonly QuarantineItem[]) {
  const destructive = action === 'delete' || action === 'learnAsSpam'
  const virusCount = items.filter((item) => item.virus).length
  return confirm({
    title: destructive
      ? lt('footer.confirm_delete')
      : lt(action === 'release' ? 'quarantine.deliver_inbox' : 'quarantine.release'),
    content: { component: QuarantineBulkConfirm, props: { items, destructive } },
    confirmLabel: destructive
      ? lt(action === 'delete' ? 'footer.delete_now' : 'quarantine.learn_spam_delete')
      : lt('quarantine.confirm'),
    cancelLabel: lt('footer.cancel'),
    destructive,
    ...(destructive
      ? {
          requireTyped: {
            accepted: [String(items.length)],
            labelKey: 'bulk.confirm.typeCount',
            labelParams: { count: items.length },
          },
        }
      : {}),
    ...(!destructive && virusCount > 0
      ? { acknowledge: { label: text('quarantineUi.bulk.virusCount', { count: virusCount }) } }
      : {}),
  })
}
