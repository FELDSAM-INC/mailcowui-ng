// The columns of the TLS policy map list, as `draw_tls_policy_table()` in `js/site/mailbox.js` has
// them (legacy form map part 1a): ID, destination, the raw policy in bold, the parameters (a dash
// when empty, as legacy's `<code>-</code>`) and active.
import type { TlsPolicyMap } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export function tlsPolicyMapColumns(t: (key: string) => string): EntryColumn<TlsPolicyMap>[] {
  return [
    { key: 'id', label: t('routing.common.id'), sort: 'id', text: (item) => String(item.id) },
    {
      key: 'destination',
      label: lt('mailbox.tls_map_dest'),
      sort: 'destination',
      text: (item) => item.destination,
    },
    { key: 'policy', label: lt('mailbox.tls_map_policy'), sort: 'policy' },
    { key: 'parameters', label: lt('mailbox.tls_map_parameters') },
    { key: 'active', label: lt('mailbox.active'), sort: 'active' },
  ]
}

export function tlsPolicyMapSorts(t: (key: string) => string): SortChoice[] {
  return [
    { value: 'id', label: t('routing.common.id') },
    { value: 'destination', label: lt('mailbox.tls_map_dest') },
    { value: 'policy', label: lt('mailbox.tls_map_policy') },
    { value: 'active', label: lt('mailbox.active') },
    { value: 'createdAt', label: lt('mailbox.created_on') },
    { value: 'modifiedAt', label: lt('mailbox.last_modified') },
  ]
}
