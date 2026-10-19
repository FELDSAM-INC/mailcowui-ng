// UI 006 (T025, T116): the spam filter's action statistics (US8-AS1: 120, 30, 0, 250 and 600 of
// 1,000), with or without the counting period.
import type { SpamFilterActionStatistics } from '@/api'

import type { MockSpamStatistics } from '../scenarios/state'

export function spamStatistics(overrides: Partial<MockSpamStatistics> = {}): MockSpamStatistics {
  return {
    rejected: 120,
    softRejected: 30,
    subjectRewritten: 0,
    movedToJunk: 250,
    noAction: 600,
    countedSince: '2026-09-01T00:00:00.000Z',
    spamFilterRunningSince: '2026-10-10T04:30:00.000Z',
    ...overrides,
  }
}

export const zeroSpamStatistics = (): MockSpamStatistics =>
  spamStatistics({
    rejected: 0,
    softRejected: 0,
    subjectRewritten: 0,
    movedToJunk: 0,
    noAction: 0,
    countedSince: null,
    spamFilterRunningSince: null,
  })

export function spamStatisticsView(stats: MockSpamStatistics): SpamFilterActionStatistics {
  return {
    ...stats,
    total:
      stats.rejected +
      stats.softRejected +
      stats.subjectRewritten +
      stats.movedToJunk +
      stats.noAction,
  }
}
