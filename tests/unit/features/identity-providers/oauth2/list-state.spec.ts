// The OAuth2 list's address parameters (T081, FR-054): the search, the sort by ID (default,
// ascending), client ID or redirect URI, the page and the page size; defaults are left out.
import { describe, expect, it } from 'vitest'

import {
  oauth2ListSchema,
  toOauth2ListParams,
} from '@/features/identity-providers/oauth2/list-state'

describe('OAuth2 list state', () => {
  it('maps the state to the listOauth2Clients query and omits an empty search', () => {
    expect(
      toOauth2ListParams({
        filters: { q: undefined },
        sort: 'id',
        order: 'asc',
        page: 1,
        size: 25,
      }),
    ).toEqual({ limit: 25, offset: 0, sort: 'id', order: 'asc' })
    expect(
      toOauth2ListParams({
        filters: { q: 'wiki' },
        sort: 'redirectUri',
        order: 'desc',
        page: 3,
        size: 50,
      }),
    ).toEqual({ limit: 50, offset: 100, sort: 'redirectUri', order: 'desc', q: 'wiki' })
  })

  it('sorts by the contract values with ID ascending as the default', () => {
    expect(oauth2ListSchema.sort?.values).toEqual(['id', 'clientId', 'redirectUri'])
    expect(oauth2ListSchema.sort?.default).toBe('id')
    expect(oauth2ListSchema.sort?.defaultOrder('clientId')).toBe('asc')
  })

  it('accepts a search up to the contract limit only', () => {
    const q = oauth2ListSchema.filters.q
    expect(q.parse('wiki')).toBe('wiki')
    expect(q.parse('x'.repeat(256))).toBeUndefined()
  })
})
