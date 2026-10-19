// UI 011 (FR-004, FR-007, T026): rates in binary units per second and the uptime in words.
import { describe, expect, it } from 'vitest'

describe('UI 011 rates and uptime (FR-004, FR-007, T026)', () => {
  it('formats rates in binary units per second', async () => {
    const { formatRate } = await import('@/features/operations/format')
    expect(formatRate(0, 'en-gb')).toBe('0 B/s')
    expect(formatRate(1536, 'en-gb')).toBe('1.5 KiB/s')
    expect(formatRate(5 * 1024 ** 2, 'en-gb')).toBe('5 MiB/s')
    expect(formatRate(null, 'en-gb')).toBe('')
  })

  it('spells the uptime as days, hours and minutes in the language', async () => {
    const { formatUptime } = await import('@/features/operations/format')
    const normal = (value: string) => value.replace(/\s/g, ' ')
    expect(normal(formatUptime(93_784, 'en-gb'))).toBe('1 day, 2 hours, 3 minutes')
    expect(normal(formatUptime(3_700, 'en-gb'))).toBe('1 hour, 1 minute')
    expect(normal(formatUptime(59, 'en-gb'))).toBe('0 minutes')
    expect(normal(formatUptime(2 * 86_400 + 60, 'cs-cz'))).toBe('2 dny, 0 hodin a 1 minuta')
  })
})
