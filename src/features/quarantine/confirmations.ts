// The confirmations of item actions and downloads (UI 006 legacy form map screen 2, D3 and D13 as
// resolved): "Deliver to inbox" is sent at once, as legacy, unless the item carries a virus (a
// high-risk action: the acknowledgement must be ticked); "Release" (without learning) is confirmed
// as the `qhandler` page confirms it (the item and `quarantine.confirm`); "Remove" and "Learn as
// spam and delete" use `#ConfirmDeleteModal`'s texts with the action's legacy label. A download
// from a virus-flagged item warns first.
import type { QuarantineItem } from '@/api'
import { lt, text } from '@/i18n'
import { confirm } from '@/shared/composables/useConfirm'

import type { ItemActionKind } from './api'
import ConfirmItem from './components/ConfirmItem.vue'

type ConfirmableItem = Pick<QuarantineItem, 'id' | 'subject' | 'sender' | 'virus'>

const acknowledgeVirus = () => ({ label: text('quarantineUi.deliver.virusAcknowledge') })

/** Asks before an action where legacy or the resolved deviations ask; true to go ahead. */
export function askItemAction(kind: ItemActionKind, item: ConfirmableItem): Promise<boolean> {
  const content = (intro?: string) => ({ component: ConfirmItem, props: { item, intro } })
  switch (kind) {
    case 'release':
      if (!item.virus) return Promise.resolve(true)
      return confirm({
        title: lt('quarantine.deliver_inbox'),
        content: content(),
        confirmLabel: lt('quarantine.deliver_inbox'),
        cancelLabel: lt('footer.cancel'),
        acknowledge: acknowledgeVirus(),
      })
    case 'releaseWithoutLearning':
      return confirm({
        title: lt('quarantine.release'),
        content: content(),
        confirmLabel: lt('quarantine.confirm'),
        cancelLabel: lt('footer.cancel'),
        ...(item.virus ? { acknowledge: acknowledgeVirus() } : {}),
      })
    case 'learnAsSpam':
      return confirm({
        title: lt('footer.confirm_delete'),
        content: content(lt('footer.delete_these_items')),
        confirmLabel: lt('quarantine.learn_spam_delete'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
    case 'delete':
      return confirm({
        title: lt('footer.confirm_delete'),
        content: content(lt('footer.delete_these_items')),
        confirmLabel: lt('footer.delete_now'),
        cancelLabel: lt('footer.cancel'),
        destructive: true,
      })
  }
}

/** The warning before a download from a virus-flagged item; true to download. */
export function askVirusDownload(): Promise<boolean> {
  return confirm({
    title: lt('quarantine.danger'),
    description: text('quarantineUi.download.virusWarning'),
    confirmLabel: lt('quarantine.confirm'),
    cancelLabel: lt('footer.cancel'),
    destructive: true,
  })
}
