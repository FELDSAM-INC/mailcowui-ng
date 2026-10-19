// The DKIM list's address parameters (T034, data-model §5, FR-005 to FR-012): repeated states,
// kind, completeness, selector and domain mapped to `listDkimKeys`; administrator-only values
// dropped for domain administrators; free text at most 255 characters.
import { describe, expect, it } from 'vitest'

import {
  dkimListSchema,
  toDkimListParams,
  type DkimListState,
} from '@/features/dns/dkim/list-state'

function parse(role: 'admin' | 'domainAdmin', query: Record<string, string | string[]>) {
  const schema = dkimListSchema(role)
  const filters = Object.fromEntries(
    Object.entries(schema.filters).map(([key, spec]) => [key, spec.parse(query[key])]),
  )
  return filters as DkimListState['filters']
}

const state = (filters: Partial<DkimListState['filters']>, extra: Partial<DkimListState> = {}) =>
  ({
    filters: {
      q: undefined,
      state: [],
      kind: undefined,
      complete: undefined,
      selector: undefined,
      domain: undefined,
      ...filters,
    },
    sort: 'name',
    order: 'asc',
    page: 1,
    size: 25,
    ...extra,
  }) as DkimListState

describe('DKIM list state', () => {
  it('maps every parameter to the query', () => {
    const params = toDkimListParams(
      state(
        {
          q: 'exa',
          state: ['valid', 'unused'],
          kind: 'domain',
          complete: 'false',
          selector: 'dkim',
          domain: 'example.org',
        },
        { sort: 'keyLength', order: 'desc', page: 3, size: 50 },
      ),
    )
    expect(params).toEqual({
      q: 'exa',
      state: ['valid', 'unused'],
      kind: 'domain',
      complete: false,
      selector: 'dkim',
      domain: 'example.org',
      sort: 'keyLength',
      order: 'desc',
      limit: 50,
      offset: 100,
    })
    expect(toDkimListParams(state({ complete: 'true' })).complete).toBe(true)
    expect(toDkimListParams(state({}))).toEqual({
      sort: 'name',
      order: 'asc',
      limit: 25,
      offset: 0,
    })
  })

  it('reads repeated states and drops unknown values', () => {
    expect(parse('admin', { state: ['valid', 'missing', 'bogus'] }).state).toEqual([
      'valid',
      'missing',
    ])
    expect(parse('admin', { state: 'unused', kind: 'none' })).toMatchObject({
      state: ['unused'],
      kind: 'none',
    })
  })

  it('drops "Key unused" and "No domain" for domain administrators', () => {
    const filters = parse('domainAdmin', { state: ['unused', 'valid'], kind: 'none' })
    expect(filters.state).toEqual(['valid'])
    expect(filters.kind).toBeUndefined()
  })

  it('accepts search, selector and domain up to 255 characters', () => {
    const long = 'a'.repeat(256)
    expect(parse('admin', { q: long, selector: long, domain: long })).toMatchObject({
      q: undefined,
      selector: undefined,
      domain: undefined,
    })
    expect(parse('admin', { q: 'a'.repeat(255) }).q).toHaveLength(255)
  })
})
