// The copy targets of a DKIM key (FR-034, research R10): domains and alias domains with or without a
// key, searched by the server 25 at a time for UI 004's shared `DomainPicker`, never the source.
// The entries read are remembered, so the page can mark targets that have a key (and their
// version tag for the overwrite).
import { queryKeys, type DkimKey } from '@/api'
import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

import { fetchDkimKeys } from '../api/dkim'

export function copyTargetSource(
  source: string,
  remember: (entries: readonly DkimKey[]) => void,
  fetchPage = fetchDkimKeys,
): DomainPickerSource {
  return {
    id: 'dkim-targets',
    queryKey: (q) => [...queryKeys.dkimKeys.copyTargets(q), source],
    async fetchPage({ q, offset, limit }) {
      const page = await fetchPage({
        state: ['valid', 'missing'],
        ...(q ? { q } : {}),
        sort: 'name',
        order: 'asc',
        limit,
        offset,
      })
      remember(page.data)
      const items = page.data
        .filter((entry) => entry.name !== source)
        .map((entry) => ({ name: entry.name, nameUnicode: entry.displayName }))
      return { items, total: page.meta.total }
    },
  }
}
