import { describe, expect, it } from 'vitest'
import { shareOf, statisticRows } from '@/features/quarantine/statistics'
import {
  spamStatistics,
  spamStatisticsView,
  zeroSpamStatistics,
} from '../../../mocks/factories/spam-statistics'

describe('spam statistics', () => {
  it('keeps legacy action order and calculates one-decimal bar widths', () => {
    const rows = statisticRows(spamStatisticsView(spamStatistics()))
    expect(rows.map((row) => row.action)).toEqual([
      'rejected',
      'softRejected',
      'subjectRewritten',
      'movedToJunk',
      'noAction',
    ])
    expect(rows.map((row) => row.width)).toEqual([12, 3, 0, 25, 60])
    expect(shareOf(1, 3)).toBeCloseTo(1 / 3)
  })
  it('renders empty statistics as zero without NaN or Infinity', () => {
    expect(
      statisticRows(spamStatisticsView(zeroSpamStatistics())).every(
        (row) => row.share === 0 && row.width === 0,
      ),
    ).toBe(true)
  })
})
