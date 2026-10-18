// T137: time ranges of the audit log (FR-073): presets resolved when the query runs, a custom range
// whose start lies before its end, and local date-time inputs converted to UTC.
import { afterEach, describe, expect, it } from 'vitest'

import {
  isoToLocalInput,
  localInputToIso,
  resolveRange,
  validateCustomRange,
} from '@/features/audit-log/time-range'

const NOW = Date.parse('2026-10-18T12:00:00Z')
let savedTz: string | undefined

afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

describe('resolveRange', () => {
  it('turns a preset into a start relative to now', () => {
    expect(resolveRange({ range: '24h' }, NOW)).toEqual({ from: '2026-10-17T12:00:00.000Z' })
    expect(resolveRange({ range: '7d' }, NOW + 1000)).toEqual({ from: '2026-10-11T12:00:01.000Z' })
    expect(resolveRange({ range: '30d' }, NOW)).toEqual({ from: '2026-09-18T12:00:00.000Z' })
  })

  it('passes a valid custom range and drops an invalid one', () => {
    const from = '2026-10-01T00:00:00.000Z'
    const to = '2026-10-05T00:00:00.000Z'
    expect(resolveRange({ range: 'custom', from, to }, NOW)).toEqual({ from, to })
    expect(resolveRange({ range: 'custom', from }, NOW)).toEqual({ from })
    expect(resolveRange({ range: 'custom', from: to, to: from }, NOW)).toEqual({})
    expect(resolveRange({ range: undefined, from, to }, NOW)).toEqual({})
  })
})

describe('validateCustomRange', () => {
  it('requires a start or an end and the start before the end', () => {
    expect(validateCustomRange('', '')).toEqual({ from: 'validation.required' })
    expect(validateCustomRange('2026-10-01T10:00', '2026-10-01T09:00')).toEqual({
      to: 'auditLog.filters.rangeOrder',
    })
    expect(validateCustomRange('2026-10-01T10:00', '2026-10-01T10:00')).toEqual({
      to: 'auditLog.filters.rangeOrder',
    })
    expect(validateCustomRange('2026-10-01T09:00', '')).toEqual({})
    expect(validateCustomRange('2026-10-01T09:00', '2026-10-02T09:00')).toEqual({})
    expect(validateCustomRange('not a date', '')).toEqual({ from: 'validation.format.dateTime' })
  })
})

describe('local date-time inputs', () => {
  it('converts the device time zone to UTC and back', () => {
    savedTz = process.env.TZ
    process.env.TZ = 'Europe/Prague'
    expect(localInputToIso('2026-10-18T14:30')).toBe('2026-10-18T12:30:00.000Z')
    expect(isoToLocalInput('2026-10-18T12:30:00.000Z')).toBe('2026-10-18T14:30')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('2026-13-45T99:99')).toBeNull()
    expect(isoToLocalInput(undefined)).toBe('')
  })
})
