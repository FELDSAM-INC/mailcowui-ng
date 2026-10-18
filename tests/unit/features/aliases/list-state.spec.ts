// The alias list's address parameters (T033, data-model §5, FR-006, FR-013, FR-014): defaults left
// out, repeatable parameters, groupware parameters ignored while the groupware is disabled or
// unknown, and "newest first" as id descending.
import { describe, expect, it } from 'vitest'

import { aliasListSchema, toAliasParams, type AliasListState } from '@/features/aliases/list-state'

function state(overrides: Partial<AliasListState> = {}): AliasListState {
  return {
    filters: {
      q: undefined,
      domain: [],
      primaryDomain: [],
      kind: [],
      destinationType: [],
      destination: undefined,
      active: undefined,
      senderAllowed: undefined,
      groupwareVisible: undefined,
      internal: undefined,
      ...overrides.filters,
    },
    sort: overrides.sort ?? 'id',
    order: overrides.order ?? 'desc',
    page: overrides.page ?? 1,
    size: overrides.size ?? 25,
  }
}

describe('alias list state', () => {
  it('sorts newest first by default: id descending, the other keys ascending', () => {
    expect(aliasListSchema.sort!.default).toBe('id')
    expect(aliasListSchema.sort!.defaultOrder('id')).toBe('desc')
    expect(aliasListSchema.sort!.defaultOrder('address')).toBe('asc')
  })

  it('parses repeatable domain and kind parameters', () => {
    expect(
      aliasListSchema.filters.domain.parse(['example.org', 'EXAMPLE.org', 'example.net']),
    ).toEqual(['example.org', 'example.net'])
    expect(aliasListSchema.filters.kind.parse(['catchAll', 'nope'])).toEqual(['catchAll'])
    expect(aliasListSchema.filters.destinationType.parse(['learnSpam', 'discard'])).toEqual([
      'learnSpam',
      'discard',
    ])
    expect(aliasListSchema.filters.active.parse('maybe')).toBeUndefined()
  })

  it('maps every filter to its request parameter and leaves unset ones out', () => {
    expect(toAliasParams(state(), { groupwareEnabled: true })).toEqual({
      limit: 25,
      offset: 0,
      sort: 'id',
      order: 'desc',
    })
    expect(
      toAliasParams(
        state({
          filters: {
            q: 'invoice',
            domain: ['example.net'],
            primaryDomain: ['example.org'],
            kind: ['catchAll'],
            destinationType: ['addresses'],
            destination: 'anna@example.org',
            active: 'true',
            senderAllowed: 'false',
            groupwareVisible: 'true',
            internal: 'false',
          },
          sort: 'address',
          order: 'asc',
          page: 3,
          size: 50,
        }),
        { groupwareEnabled: true },
      ),
    ).toEqual({
      limit: 50,
      offset: 100,
      sort: 'address',
      order: 'asc',
      q: 'invoice',
      domain: ['example.net'],
      primaryDomain: ['example.org'],
      kind: ['catchAll'],
      destinationType: ['addresses'],
      destination: ['anna@example.org'],
      active: true,
      senderAllowed: false,
      groupwareVisible: true,
      internal: false,
    })
  })

  it('ignores the groupware filter and sort while the groupware is disabled or unknown', () => {
    const groupware = state({
      filters: { groupwareVisible: 'false' } as never,
      sort: 'groupwareVisible',
      order: 'asc',
    })
    for (const groupwareEnabled of [false, undefined]) {
      const params = toAliasParams(groupware, { groupwareEnabled })
      expect(params.groupwareVisible).toBeUndefined()
      expect(params.sort).toBe('id')
      expect(params.order).toBe('desc')
    }
  })
})
