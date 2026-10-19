// The domain picker sources of UI 004 (research D11, R7): the domains and the alias domains of the
// caller's scope, searched and paged by the server, under the query keys their mutations refresh.
import { api, queryKeys, requireData } from '@/api'
import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

const PICKER_PAGE = { sort: 'name', order: 'asc' } as const

/**
 * The domains of the caller's scope for the domain pickers (FR-011), under UI 002's `domains` key,
 * so that domain mutations refresh them. Each option says whether it is a relay domain.
 */
export function domainPickerSource(label?: string): DomainPickerSource {
  return {
    id: 'domains',
    label,
    queryKey: (q) => [...queryKeys.domains.lists(), 'picker', { q }],
    fetchPage: async ({ q, offset, limit }) => {
      const page = requireData(
        await api.GET('/domains', {
          params: { query: { ...PICKER_PAGE, limit, offset, ...(q ? { q } : {}) } },
        }),
      )
      return {
        items: page.data.map((domain) => ({
          name: domain.name,
          nameUnicode: domain.unicodeName,
          relay: domain.backupMx,
        })),
        total: page.meta.total,
      }
    },
  }
}

/** The alias domains of the caller's scope, for the "Domain" filter (data-model §3). */
export function aliasDomainPickerSource(label?: string): DomainPickerSource {
  return {
    id: 'aliasDomains',
    label,
    queryKey: (q) => queryKeys.aliasDomains.options(q),
    fetchPage: async ({ q, offset, limit }) => {
      const page = requireData(
        await api.GET('/alias-domains', {
          params: { query: { ...PICKER_PAGE, limit, offset, ...(q ? { q } : {}) } },
        }),
      )
      return {
        items: page.data.map((item) => ({ name: item.name, nameUnicode: item.nameUnicode })),
        total: page.meta.total,
      }
    },
  }
}
