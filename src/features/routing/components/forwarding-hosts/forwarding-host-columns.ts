// The columns of the forwarding host list, as `draw_fwd_hosts()` in `js/site/admin.js` has them
// (legacy form map part 1a): host, source (a button that filters by it) and the spam filter.
import type { ForwardingHost } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export function forwardingHostColumns(): EntryColumn<ForwardingHost>[] {
  return [
    { key: 'address', label: lt('admin.host'), sort: 'address', text: (item) => item.address },
    { key: 'source', label: lt('admin.source'), sort: 'source' },
    { key: 'spamFilter', label: lt('admin.spamfilter'), sort: 'spamFilter' },
  ]
}

export function forwardingHostSorts(): SortChoice[] {
  return [
    { value: 'address', label: lt('admin.host') },
    { value: 'source', label: lt('admin.source') },
    { value: 'spamFilter', label: lt('admin.spamfilter') },
  ]
}
