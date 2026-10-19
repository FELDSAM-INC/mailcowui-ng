// UI 011 (research R7, T050): chart scales: a fixed 0–100 % scale for percentages, a "nice" binary
// maximum for rates, and the points of a series in the chart's view box.
import { describe, expect, it } from 'vitest'

import {
  niceBinaryMax,
  points,
  scaleMax,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '@/features/operations/charts/scale'

describe('scale', () => {
  it('keeps percentages on a fixed 0–100 scale', () => {
    expect(scaleMax('percent', [3, 12])).toBe(100)
    expect(scaleMax('percent', [])).toBe(100)
  })

  it('rounds rates up to a nice binary step', () => {
    expect(niceBinaryMax(0)).toBe(1024)
    expect(niceBinaryMax(900)).toBe(1024)
    expect(niceBinaryMax(1500)).toBe(2048)
    expect(niceBinaryMax(5 * 1024 ** 2)).toBe(8 * 1024 ** 2)
    expect(scaleMax('rate', [100, null, 3000])).toBe(4096)
  })

  it('places the samples left to right and leaves null values out', () => {
    const line = points([0, 50, null, 100], 100, 4)
    expect(line).toEqual([
      [0, VIEW_HEIGHT],
      [VIEW_WIDTH / 3, VIEW_HEIGHT / 2],
      [VIEW_WIDTH, 0],
    ])
  })
})
