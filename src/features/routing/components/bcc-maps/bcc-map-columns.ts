// The columns of the BCC map list, as `draw_bcc_table()` in `js/site/mailbox.js` has them (legacy
// form map part 1a): ID, the type in text, local destination, BCC destination, domain (with
// "Domain no longer exists" on orphaned maps for administrators) and active.
import type { BccMap, BccMapType } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export const bccTypeLabel = (type: BccMapType) =>
  lt(type === 'sender' ? 'mailbox.bcc_sender_map' : 'mailbox.bcc_rcpt_map')

export function bccMapColumns(t: (key: string) => string): EntryColumn<BccMap>[] {
  return [
    { key: 'id', label: t('routing.common.id'), sort: 'id', text: (item) => String(item.id) },
    {
      key: 'type',
      label: lt('mailbox.bcc_type'),
      sort: 'type',
      text: (item) => bccTypeLabel(item.type),
    },
    {
      key: 'localDestination',
      label: lt('mailbox.bcc_local_dest'),
      sort: 'localDestination',
      text: (item) => item.localDestination,
    },
    {
      key: 'bccDestination',
      label: lt('mailbox.bcc_destinations'),
      sort: 'bccDestination',
      text: (item) => item.bccDestination,
    },
    { key: 'domain', label: lt('mailbox.domain'), sort: 'domain', text: (item) => item.domain },
    { key: 'active', label: lt('mailbox.active'), sort: 'active' },
  ]
}

export function bccMapSorts(t: (key: string) => string): SortChoice[] {
  return [
    { value: 'id', label: t('routing.common.id') },
    { value: 'type', label: lt('mailbox.bcc_type') },
    { value: 'localDestination', label: lt('mailbox.bcc_local_dest') },
    { value: 'bccDestination', label: lt('mailbox.bcc_destinations') },
    { value: 'domain', label: lt('mailbox.domain') },
    { value: 'active', label: lt('mailbox.active') },
    { value: 'createdAt', label: lt('mailbox.created_on') },
    { value: 'modifiedAt', label: lt('mailbox.last_modified') },
  ]
}
