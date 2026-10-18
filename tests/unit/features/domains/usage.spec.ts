// Usage levels (UI 002 T022, research D10, FR-008).
import { describe, expect, it } from 'vitest'

import { usageLevel } from '@/features/domains/usage'

describe('usageLevel', () => {
  it('is ok below 90 %, nearly full from 90 % to 100 % and over above the limit', () => {
    expect(usageLevel(8, 10)).toBe('ok')
    expect(usageLevel(9, 10)).toBe('nearlyFull')
    expect(usageLevel(380, 400)).toBe('nearlyFull')
    expect(usageLevel(10, 10)).toBe('nearlyFull')
    expect(usageLevel(12, 10)).toBe('over')
  })

  it('counts a limit of 0 as full', () => {
    expect(usageLevel(0, 0)).toBe('nearlyFull')
    expect(usageLevel(1, 0)).toBe('over')
  })
})
