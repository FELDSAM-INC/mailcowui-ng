import { describe, expect, it } from 'vitest'
import { defaultValidity, validityPresets, validityPatch } from '@/features/account/validity'

const limits = { minLifetimeHours: 1, maxLifetimeHours: 87600, defaultLifetimeHours: 8760 }
describe('temporary alias validity', () => {
  it('keeps the legacy presets, including the 31-day month, and the server default', () => {
    expect(validityPresets(limits).map((item) => item.value)).toEqual([
      '1',
      '24',
      '168',
      '744',
      '8760',
      '87600',
      'permanent',
    ])
    expect(defaultValidity(limits)).toBe('8760')
    expect(validityPatch('168')).toEqual({ lifetimeHours: 168 })
    expect(validityPatch('permanent')).toEqual({ permanent: true })
  })
  it('offers only supported hours and keeps permanence when no preset fits', () => {
    expect(
      validityPresets({ ...limits, minLifetimeHours: 24, maxLifetimeHours: 168 }).map(
        (item) => item.value,
      ),
    ).toEqual(['24', '168', 'permanent'])
    expect(defaultValidity({ ...limits, minLifetimeHours: 24, maxLifetimeHours: 168 })).toBe('24')
    expect(defaultValidity({ ...limits, minLifetimeHours: 2, maxLifetimeHours: 3 })).toBe(
      'permanent',
    )
  })
})
