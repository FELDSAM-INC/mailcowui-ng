// The domains of the caller's scope as a source of the shared `DomainPicker` (research R9): the
// domain filter of the list, searched on the server, 25 per page, keyed under `['domains', …]` so
// that domain changes refresh it.
import { api, queryKeys, requireData, type DomainListParams } from '@/api'
import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

function params(q: string, offset: number, limit: number): DomainListParams {
  return { limit, offset, sort: 'name', order: 'asc', ...(q ? { q } : {}) }
}

export const domainSource: DomainPickerSource = {
  id: 'domains',
  queryKey: (q) => queryKeys.domains.list(params(q, 0, 0)),
  async fetchPage({ q, offset, limit }) {
    const page = requireData(
      await api.GET('/domains', { params: { query: params(q, offset, limit) } }),
    )
    return {
      items: page.data.map((domain) => ({ name: domain.name, nameUnicode: domain.unicodeName })),
      total: page.meta.total,
    }
  },
}
