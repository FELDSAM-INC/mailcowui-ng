// The columns of the recipient map list, as `draw_recipient_map_table()` in `js/site/mailbox.js`
// has them (legacy form map part 1a): ID, original recipient, new recipient and active.
import type { RecipientMap } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export function recipientMapColumns(t: (key: string) => string): EntryColumn<RecipientMap>[] {
  return [
    { key: 'id', label: t('routing.common.id'), sort: 'id', text: (item) => String(item.id) },
    {
      key: 'originalDestination',
      label: lt('mailbox.recipient_map_old'),
      sort: 'originalDestination',
      text: (item) => item.originalDestination,
    },
    {
      key: 'newDestination',
      label: lt('mailbox.recipient_map_new'),
      sort: 'newDestination',
      text: (item) => item.newDestination,
    },
    { key: 'active', label: lt('mailbox.active'), sort: 'active' },
  ]
}

export function recipientMapSorts(t: (key: string) => string): SortChoice[] {
  return [
    { value: 'id', label: t('routing.common.id') },
    { value: 'originalDestination', label: lt('mailbox.recipient_map_old') },
    { value: 'newDestination', label: lt('mailbox.recipient_map_new') },
    { value: 'active', label: lt('mailbox.active') },
    { value: 'createdAt', label: lt('mailbox.created_on') },
    { value: 'modifiedAt', label: lt('mailbox.last_modified') },
  ]
}
