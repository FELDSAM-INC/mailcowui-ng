// The columns of the transport list, as `draw_transport_maps()` in `js/site/admin.js` has them
// (legacy form map part 1a): ID, destination (MX-based ones marked with `admin.is_mx_based` in text
// instead of the tooltip icon), next hop, username (without the colour square) and active.
import type { Transport } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export function transportColumns(t: (key: string) => string): EntryColumn<Transport>[] {
  return [
    { key: 'id', label: t('routing.common.id'), sort: 'id', text: (item) => String(item.id) },
    {
      key: 'destination',
      label: lt('admin.destination'),
      sort: 'destination',
      text: (item) => item.destination,
    },
    { key: 'nextHop', label: lt('admin.nexthop'), sort: 'nextHop', text: (item) => item.nextHop },
    {
      key: 'username',
      label: lt('admin.username'),
      sort: 'username',
      text: (item) => item.username ?? '',
    },
    { key: 'active', label: lt('admin.active'), sort: 'active' },
  ]
}

export function transportSorts(t: (key: string) => string): SortChoice[] {
  return [
    { value: 'id', label: t('routing.common.id') },
    { value: 'destination', label: lt('admin.destination') },
    { value: 'nextHop', label: lt('admin.nexthop') },
    { value: 'username', label: lt('admin.username') },
    { value: 'active', label: lt('admin.active') },
    { value: 'mxBased', label: lt('admin.is_mx_based') },
  ]
}
