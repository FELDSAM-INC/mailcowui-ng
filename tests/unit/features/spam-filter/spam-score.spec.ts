// UI 006 T083 (research R17, data-model §2 "Score values"): the spam score in tenths, its checks
// from the capabilities' range, and the three zones of the band with their display widths.
import { describe, expect, it } from 'vitest'

import { bandZones, MAX_SCALE_TENTHS, validatePair } from '@/features/spam-filter/spam-score'

const RANGE = { min: 0, max: 5000, step: 0.1 }

describe('validatePair', () => {
  it('accepts a pair inside the range with junk at most reject', () => {
    expect(validatePair(65, 120, RANGE)).toEqual([])
    expect(validatePair(100, 100, RANGE)).toEqual([])
    expect(validatePair(0, 50_000, RANGE)).toEqual([])
  })

  it('refuses a junk value above the reject value on the junk field, naming the reject value', () => {
    expect(validatePair(120, 60, RANGE)).toEqual([
      { field: 'junkScore', code: 'mustNotExceed', params: { field: 'rejectScore', value: 6 } },
    ])
  })

  it('refuses values outside the range with its limits, before comparing them', () => {
    expect(validatePair(50_001, 50_002, RANGE)).toEqual([
      { field: 'junkScore', code: 'outOfRange', params: { min: 0, max: 5000 } },
      { field: 'rejectScore', code: 'outOfRange', params: { min: 0, max: 5000 } },
    ])
    expect(validatePair(-1, 10, RANGE)).toEqual([
      { field: 'junkScore', code: 'outOfRange', params: { min: 0, max: 5000 } },
    ])
  })

  it('takes the range and the step from the capabilities', () => {
    expect(validatePair(3, 150, { min: 0, max: 10, step: 0.5 })).toEqual([
      { field: 'junkScore', code: 'notMultipleOf', params: { factor: 0.5 } },
      { field: 'rejectScore', code: 'outOfRange', params: { min: 0, max: 10 } },
    ])
  })
})

describe('bandZones', () => {
  const widths = (zones: ReturnType<typeof bandZones>) => zones.map((zone) => zone.width)

  it('names the three zones in legacy order with their ranges in tenths', () => {
    const zones = bandZones(80, 150)
    expect(
      zones.map((zone) => [zone.id, zone.from, zone.to, zone.labelKey, zone.rangeKey]),
    ).toEqual([
      ['green', 0, 80, 'user.spamfilter_green', 'spamFilter.score.rangeBelow'],
      ['yellow', 80, 150, 'user.spamfilter_yellow', 'spamFilter.score.rangeBetween'],
      ['red', 150, MAX_SCALE_TENTHS, 'user.spamfilter_red', 'spamFilter.score.rangeAbove'],
    ])
  })

  it('is linear up to one and a half times the reject value, with a tail for the rest', () => {
    // Scale 225 tenths over 90 %: 80 → 32 %, 150 → 60 %.
    expect(widths(bandZones(80, 150))).toEqual([32, 28, 40])
    expect(widths(bandZones(80, 150)).reduce((sum, width) => sum + width, 0)).toBe(100)
  })

  it('keeps small values readable on a scale of at least 20', () => {
    // Scale 200 tenths: 0 → 0 %, 10 → 4.5 %.
    expect(widths(bandZones(0, 10))).toEqual([0, 4.5, 95.5])
    expect(widths(bandZones(0, 0))).toEqual([0, 0, 100])
  })

  it('gives equal values an empty yellow zone', () => {
    expect(widths(bandZones(100, 100))[1]).toBe(0)
  })

  it('has no tail when the scale reaches the maximum', () => {
    expect(widths(bandZones(0, 50_000))).toEqual([0, 100, 0])
    expect(widths(bandZones(40_000, 50_000))).toEqual([80, 20, 0])
  })
})
