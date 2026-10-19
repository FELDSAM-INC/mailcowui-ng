// The mailbox list's address parameters (UI 003 T052, data-model §5): mapped to `listMailboxes`,
// defaults left out, repeatable filters, invalid values dropped.
import { describe, expect, it } from 'vitest'

import { mailboxListSchema, toListParams } from '@/features/mailboxes/list-state'

const parse = (query: Record<string, string | string[]>) => {
  const filters = Object.fromEntries(
    Object.entries(mailboxListSchema.filters).map(([key, spec]) => [key, spec.parse(query[key])]),
  )
  return filters as ReturnType<typeof toListParams> & Record<string, unknown>
}

describe('mailbox list state', () => {
  it('maps the defaults to the first page sorted by address', () => {
    expect(
      toListParams({
        filters: { q: undefined, domain: [], status: [], tag: [], source: [] },
        sort: 'address',
        order: 'asc',
        page: 1,
        size: 25,
      }),
    ).toEqual({ limit: 25, offset: 0, sort: 'address', order: 'asc' })
  })

  it('maps the search, the repeatable filters, the sort and the page', () => {
    expect(
      toListParams({
        filters: {
          q: 'anna',
          domain: ['a.example'],
          status: ['inactive', 'active'],
          tag: ['Sales'],
          source: ['ldap'],
        },
        sort: 'percentUsed',
        order: 'desc',
        page: 3,
        size: 50,
      }),
    ).toEqual({
      limit: 50,
      offset: 100,
      sort: 'percentUsed',
      order: 'desc',
      q: 'anna',
      domain: ['a.example'],
      status: ['inactive', 'active'],
      tag: ['Sales'],
      authSource: ['ldap'],
    })
  })

  it('drops invalid values', () => {
    const filters = parse({
      status: ['active', 'nope'],
      source: 'x',
      domain: ['', 'A.example', 'a.example'],
    })
    expect(filters.status).toEqual(['active'])
    expect(filters.source).toEqual([])
    expect(filters.domain).toEqual(['A.example'])
    expect(mailboxListSchema.sort?.values).toContain('lastMailLogin')
  })
})
