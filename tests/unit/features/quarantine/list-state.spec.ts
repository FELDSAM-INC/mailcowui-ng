// UI 006 T046 (data-model §6, research R12): the quarantine list's address parameters. Defaults
// are left out, invalid values dropped; the first and last day become UTC instants of the device
// time zone with `to` as the start of the next day (the API's `to` is exclusive), also across a
// change of daylight saving time; scores keep `.`; a mailbox user's `recipient` and `domain` are
// ignored; an inverted range is not sent.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  activeFilterCount,
  dayRangeInverted,
  dayToInstant,
  NO_FILTERS,
  quarantineListSchema,
  scoreFromTenths,
  scoreRangeInverted,
  scoreToTenths,
  toListParams,
  type QuarantineListFilters,
} from '@/features/quarantine/list-state'

const parse = (query: Record<string, string | string[]>): QuarantineListFilters =>
  Object.fromEntries(
    Object.entries(quarantineListSchema.filters).map(([key, spec]) => [
      key,
      spec.parse(query[key]),
    ]),
  ) as QuarantineListFilters

const state = (filters: Partial<QuarantineListFilters> = {}, rest = {}) => ({
  filters: { ...NO_FILTERS, ...filters },
  sort: 'arrivedAt' as const,
  order: 'desc' as const,
  page: 1,
  size: 25 as const,
  ...rest,
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('quarantine list state', () => {
  it('maps the defaults to the newest first, 25 per page', () => {
    expect(toListParams(state(), { scoped: false })).toEqual({
      limit: 25,
      offset: 0,
      sort: 'arrivedAt',
      order: 'desc',
    })
  })

  it('orders arrival, identifier and score descending and the others ascending by default', () => {
    const order = quarantineListSchema.sort!.defaultOrder
    expect(['arrivedAt', 'id', 'score'].map((key) => order(key as never))).toEqual([
      'desc',
      'desc',
      'desc',
    ])
    expect(
      ['queueId', 'sender', 'recipient', 'subject', 'action', 'virus', 'notified'].map((key) =>
        order(key as never),
      ),
    ).toEqual(Array(7).fill('asc'))
    expect(quarantineListSchema.sort!.values).toHaveLength(10)
  })

  it('maps every filter, the sort and the page for administrators', () => {
    const filters = parse({
      q: ' invoice ',
      recipient: 'Bob@Example.org',
      domain: 'example.org',
      action: ['junk', 'rejected'],
      virus: 'true',
      notified: 'false',
      minScore: '5.5',
      maxScore: '20',
    })
    expect(
      toListParams(state(filters, { sort: 'score', order: 'asc', page: 3, size: 50 }), {
        scoped: true,
      }),
    ).toEqual({
      limit: 50,
      offset: 100,
      sort: 'score',
      order: 'asc',
      q: 'invoice',
      recipient: 'Bob@Example.org',
      domain: 'example.org',
      action: ['junk', 'rejected'],
      virus: true,
      notified: false,
      minScore: 5.5,
      maxScore: 20,
    })
  })

  it('ignores the recipient and the domain of a mailbox user', () => {
    const params = toListParams(state({ recipient: 'bob@example.org', domain: 'example.org' }), {
      scoped: false,
    })
    expect(params).not.toHaveProperty('recipient')
    expect(params).not.toHaveProperty('domain')
    expect(activeFilterCount({ ...NO_FILTERS, recipient: 'bob@example.org' }, false)).toBe(0)
    expect(activeFilterCount({ ...NO_FILTERS, recipient: 'bob@example.org' }, true)).toBe(1)
  })

  it('drops invalid values', () => {
    const filters = parse({
      action: ['junk', 'nope'],
      virus: 'yes',
      notified: 'TRUE',
      from: '2026-13-01',
      to: '2026-02-30',
      minScore: '5,5',
      maxScore: '-1',
      recipient: 'not an address',
      domain: 'x'.repeat(256),
    })
    expect(filters).toEqual({ ...NO_FILTERS, action: ['junk'] })
    expect(parse({ minScore: '7.25' }).minScore).toBeUndefined()
    expect(parse({ minScore: '7.0' }).minScore).toBe('7.0')
    expect(parse({ from: '2026-02-28' }).from).toBe('2026-02-28')
  })

  it('converts days to instants of the device time zone, `to` exclusive at the next day', () => {
    vi.stubEnv('TZ', 'Europe/Prague')
    const params = toListParams(state({ from: '2026-10-01', to: '2026-10-02' }), { scoped: false })
    expect(params.from).toBe(new Date(2026, 9, 1).toISOString())
    expect(params.to).toBe(new Date(2026, 9, 3).toISOString())
    expect(dayToInstant('2026-10-01', 0)).toBe(new Date(2026, 9, 1).toISOString())
  })

  it('keeps whole days across a change of daylight saving time', () => {
    vi.stubEnv('TZ', 'Europe/Prague')
    // The last Sunday of October 2026 has 25 hours in Central Europe.
    const from = new Date(dayToInstant('2026-10-25', 0))
    const to = new Date(dayToInstant('2026-10-25', 1))
    expect(from.getDate()).toBe(25)
    expect(from.getHours()).toBe(0)
    expect(to.getDate()).toBe(26)
    expect(to.getHours()).toBe(0)
  })

  it('sends no inverted day or score range', () => {
    const filters = {
      ...NO_FILTERS,
      from: '2026-10-05',
      to: '2026-10-01',
      minScore: '9',
      maxScore: '3',
    }
    expect(dayRangeInverted(filters)).toBe(true)
    expect(scoreRangeInverted(filters)).toBe(true)
    const params = toListParams(state(filters), { scoped: false })
    expect(params).not.toHaveProperty('from')
    expect(params).not.toHaveProperty('to')
    expect(params).not.toHaveProperty('minScore')
    expect(params).not.toHaveProperty('maxScore')
    expect(dayRangeInverted({ ...NO_FILTERS, from: '2026-10-01', to: '2026-10-01' })).toBe(false)
  })

  it('converts scores between the address and tenths', () => {
    expect(scoreToTenths('6.5')).toBe(65)
    expect(scoreToTenths(undefined)).toBeNull()
    expect(scoreFromTenths(65)).toBe('6.5')
    expect(scoreFromTenths(70)).toBe('7')
    expect(scoreFromTenths(null)).toBeUndefined()
  })

  it('counts each set filter value once, without the search', () => {
    expect(
      activeFilterCount(
        { ...NO_FILTERS, q: 'x', action: ['junk', 'rejected'], virus: 'true', from: '2026-10-01' },
        false,
      ),
    ).toBe(4)
  })
})
