// The bulk actions of each routing list (data-model §2 BulkActionCatalogue, research R5): legacy's
// quick actions with their legacy labels, from the generated action arrays. A deletion needs the
// number of entries typed; activation and deactivation are not confirmed (legacy form map part 3,
// decision 8). Each target carries the entry's version as listed, without the quotes (G33).
import {
  bccMapBulkActionRequestActionValues,
  forwardingHostBulkActionRequestActionValues,
  recipientMapBulkActionRequestActionValues,
  relayhostBulkActionRequestActionValues,
  tlsPolicyMapBulkActionRequestActionValues,
  transportBulkActionRequestActionValues,
  type BulkTarget,
} from '@/api'
import { legacy, type TextRef } from '@/i18n'

import { bareEtag } from './changed-fields'

export type BulkCollection =
  'relayhosts' | 'transports' | 'tlsPolicyMaps' | 'recipientMaps' | 'bccMaps' | 'forwardingHosts'

export const BULK_ACTIONS = {
  relayhosts: relayhostBulkActionRequestActionValues,
  transports: transportBulkActionRequestActionValues,
  tlsPolicyMaps: tlsPolicyMapBulkActionRequestActionValues,
  recipientMaps: recipientMapBulkActionRequestActionValues,
  bccMaps: bccMapBulkActionRequestActionValues,
  forwardingHosts: forwardingHostBulkActionRequestActionValues,
} as const

export type BulkActionOf<C extends BulkCollection> = (typeof BULK_ACTIONS)[C][number]
export type AnyBulkAction = BulkActionOf<BulkCollection>

/** The admin page's lists (`lang_admin`) say `admin.remove`, the mail setup lists `mailbox.remove`. */
const ADMIN_LISTS = new Set<BulkCollection>(['relayhosts', 'transports', 'forwardingHosts'])

export function bulkActionLabel(collection: BulkCollection, action: AnyBulkAction): TextRef {
  switch (action) {
    case 'activate':
      return legacy('mailbox.activate')
    case 'deactivate':
      return legacy('mailbox.deactivate')
    case 'switchToSender':
      return legacy('mailbox.bcc_to_sender')
    case 'switchToRecipient':
      return legacy('mailbox.bcc_to_rcpt')
    case 'enableSpamFilter':
      return 'routing.forwardingHosts.enableSpamFilter'
    case 'disableSpamFilter':
      return 'routing.forwardingHosts.disableSpamFilter'
    case 'delete':
      return legacy(ADMIN_LISTS.has(collection) ? 'admin.remove' : 'mailbox.remove')
  }
}

export const isDestructive = (action: AnyBulkAction) => action === 'delete'

/** The target of an entry: its ID (or a forwarding host's stored address, unencoded). */
export function targetOf(
  entry: { id: number; etag: string } | { address: string; etag: string },
): BulkTarget {
  return {
    id: 'address' in entry ? entry.address : String(entry.id),
    version: bareEtag(entry.etag),
  }
}
