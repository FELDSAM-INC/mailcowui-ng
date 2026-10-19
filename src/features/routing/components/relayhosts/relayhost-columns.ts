// The columns of the relayhost list, as `draw_relayhosts()` in `js/site/admin.js` has them (legacy
// form map part 1a): ID (hard-coded), host, username, "in use by" and active. The host names the
// entry; the usage and the active state are rendered by the page's cell slots.
import type { Relayhost } from '@/api'
import { lt } from '@/i18n'

import type { EntryColumn, SortChoice } from '../common/entry-list'

export function relayhostColumns(t: (key: string) => string): EntryColumn<Relayhost>[] {
  return [
    { key: 'id', label: t('routing.common.id'), sort: 'id', text: (item) => String(item.id) },
    { key: 'host', label: lt('admin.host'), sort: 'host', text: (item) => item.host },
    {
      key: 'username',
      label: lt('admin.username'),
      sort: 'username',
      text: (item) => item.username ?? '',
    },
    { key: 'usage', label: lt('admin.in_use_by') },
    { key: 'active', label: lt('admin.active'), sort: 'active' },
  ]
}

/** The sorts of `RelayhostSort`, labelled with the column headers. */
export function relayhostSorts(t: (key: string) => string): SortChoice[] {
  return [
    { value: 'id', label: t('routing.common.id') },
    { value: 'host', label: lt('admin.host') },
    { value: 'username', label: lt('admin.username') },
    { value: 'active', label: lt('admin.active') },
    { value: 'domainCount', label: `${lt('admin.in_use_by')}: ${lt('mailbox.domains')}` },
    { value: 'mailboxCount', label: `${lt('admin.in_use_by')}: ${lt('mailbox.mailboxes')}` },
  ]
}

/** A relayhost's readable name: the host, with the username when several share a host. */
export const relayhostName = (item: Pick<Relayhost, 'host' | 'username'>) =>
  item.username ? `${item.host} (${item.username})` : item.host
