// T127: expiry presets and specific dates (FR-065, data-model §6).
import { afterEach, describe, expect, it } from 'vitest'

import {
  isInFuture,
  localInputToIso,
  localInputValue,
  presetExpiry,
  resolveExpiry,
} from '@/features/api-keys/expiry'

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
let savedTz: string | undefined

afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

describe('presets', () => {
  it('counts 30, 90 and 365 days from now', () => {
    expect(presetExpiry(30, NOW)).toBe('2026-11-17T12:00:00.000Z')
    expect(presetExpiry(90, NOW)).toBe(new Date(NOW + 90 * 86_400_000).toISOString())
    expect(presetExpiry(365, NOW)).toBe('2027-10-18T12:00:00.000Z')
  })
})

describe('specific dates', () => {
  it('reads a datetime-local value in the device time zone and sends UTC', () => {
    savedTz = process.env.TZ
    process.env.TZ = 'Europe/Prague'
    expect(localInputToIso('2027-01-15T10:30')).toBe('2027-01-15T09:30:00.000Z')
    expect(localInputToIso('2027-07-15T10:30')).toBe('2027-07-15T08:30:00.000Z')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('not a date')).toBeNull()
  })

  it('formats a date for the min attribute of datetime-local', () => {
    expect(localInputValue(new Date(2026, 9, 18, 7, 5))).toBe('2026-10-18T07:05')
  })

  it('checks that a time lies in the future', () => {
    expect(isInFuture('2026-10-18T12:00:01Z', NOW)).toBe(true)
    expect(isInFuture('2026-10-18T12:00:00Z', NOW)).toBe(false)
  })
})

describe('resolveExpiry', () => {
  it('resolves never, presets and a specific date, or names the problem', () => {
    expect(resolveExpiry('never', '', NOW)).toEqual({ ok: true, value: null })
    expect(resolveExpiry('30', '', NOW)).toEqual({ ok: true, value: presetExpiry(30, NOW) })
    expect(resolveExpiry('custom', '', NOW)).toEqual({ ok: false, error: 'validation.required' })
    expect(resolveExpiry('custom', '2020-01-01T10:00', NOW)).toEqual({
      ok: false,
      error: 'validation.mustBeInFuture',
    })
    expect(resolveExpiry('custom', 'x', NOW)).toEqual({
      ok: false,
      error: 'validation.format.dateTime',
    })
    const later = resolveExpiry('custom', '2030-01-01T00:00', NOW)
    expect(later.ok && later.value).toBe(new Date(2030, 0, 1).toISOString())
  })
})
