// Locale formatting (FR-087, research R15): dates, numbers, relative times and lists per locale,
// always in the device time zone.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { formatDateTime, formatList, formatNumber, formatRelativeTime } from '@/i18n/format'

const INSTANT = '2026-10-18T12:05:00Z'
let savedTz: string | undefined

beforeEach(() => {
  savedTz = process.env.TZ
})

afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

describe('dates and times', () => {
  it('formats per locale in the device time zone', () => {
    process.env.TZ = 'Europe/Prague'
    expect(formatDateTime(INSTANT, 'en-gb')).toContain('14:05')
    expect(formatDateTime(INSTANT, 'en-gb')).toContain('18 Oct 2026')
    expect(formatDateTime(INSTANT, 'cs-cz')).toContain('18. 10. 2026')
    expect(formatDateTime(INSTANT, 'sk-sk')).toContain('14:05')

    process.env.TZ = 'America/New_York'
    expect(formatDateTime(INSTANT, 'en-gb')).toContain('08:05')
  })

  it('formats a date or a time alone', () => {
    process.env.TZ = 'UTC'
    expect(formatDateTime(INSTANT, 'en-gb', 'date')).toBe('18 Oct 2026')
    expect(formatDateTime(INSTANT, 'en-gb', 'time')).toBe('12:05')
  })

  it('accepts Date objects and epoch milliseconds', () => {
    process.env.TZ = 'UTC'
    const date = new Date(INSTANT)
    expect(formatDateTime(date, 'en-gb')).toBe(formatDateTime(date.getTime(), 'en-gb'))
  })
})

describe('numbers', () => {
  it('formats per locale', () => {
    expect(formatNumber(1234567.5, 'en-gb')).toBe('1,234,567.5')
    expect(formatNumber(1234567.5, 'cs-cz')).toMatch(/^1\s234\s567,5$/)
    expect(formatNumber(1234567.5, 'sk-sk')).toMatch(/^1\s234\s567,5$/)
  })
})

describe('relative times', () => {
  const now = Date.parse(INSTANT)

  it('picks a unit and formats per locale', () => {
    expect(formatRelativeTime(now - 5 * 60_000, 'en-gb', now)).toBe('5 minutes ago')
    expect(formatRelativeTime(now - 5 * 60_000, 'cs-cz', now)).toBe('před 5 minutami')
    expect(formatRelativeTime(now - 2 * 86_400_000, 'en-gb', now)).toBe('2 days ago')
    expect(formatRelativeTime(now + 3 * 3_600_000, 'en-gb', now)).toBe('in 3 hours')
    expect(formatRelativeTime(now - 10_000, 'sk-sk', now)).toBe('pred 10 sekundami')
  })

  it('says "now" for the current moment', () => {
    expect(formatRelativeTime(now, 'en-gb', now)).toBe('now')
  })
})

describe('lists', () => {
  it('joins values per locale', () => {
    expect(formatList(['a', 'b', 'c'], 'en-gb')).toBe('a, b and c')
    // Czech keeps the conjunction with the next word (a no-break space).
    expect(formatList(['a', 'b', 'c'], 'cs-cz')).toMatch(/^a, b a\s+c$/)
    expect(formatList(['a', 'b'], 'en-gb', 'disjunction')).toBe('a or b')
  })
})
