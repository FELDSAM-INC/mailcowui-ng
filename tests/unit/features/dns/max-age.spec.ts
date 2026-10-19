// The MTA-STS max age (T067, research R18 as settled: seconds, as the classic form takes them): a
// whole number typed in seconds, inside the capabilities' range.
import { describe, expect, it } from 'vitest'

import { maxAgeInRange, parseMaxAge } from '@/features/dns/mta-sts/max-age'

const caps = { maxAgeMin: 1, maxAgeMax: 31_557_600 }

describe('max age', () => {
  it('reads whole numbers of seconds only', () => {
    expect(parseMaxAge('604800')).toBe(604_800)
    expect(parseMaxAge(' 86400 ')).toBe(86_400)
    expect(parseMaxAge('')).toBeNull()
    expect(parseMaxAge('1.5')).toBeNull()
    expect(parseMaxAge('-1')).toBeNull()
    expect(parseMaxAge('1e3')).toBeNull()
    expect(parseMaxAge('one')).toBeNull()
  })

  it('checks the range of the capabilities', () => {
    expect(maxAgeInRange(1, caps)).toBe(true)
    expect(maxAgeInRange(31_557_600, caps)).toBe(true)
    expect(maxAgeInRange(0, caps)).toBe(false)
    expect(maxAgeInRange(31_557_601, caps)).toBe(false)
  })
})
