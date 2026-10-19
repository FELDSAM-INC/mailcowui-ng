// The spam filter's action statistics as rows (UI 006 US8, FR-065, legacy form map screen 9, D8):
// legacy's five Rspamd actions in legacy order, each with its count, its share of the total and the
// width of its decorative bar. A zero total gives every action 0 %.
import type { SpamFilterActionStatistics } from '@/api'

export type StatisticAction =
  'rejected' | 'softRejected' | 'subjectRewritten' | 'movedToJunk' | 'noAction'

/** Legacy's order; the labels are Rspamd's action names, as legacy shows them in every language. */
export const STATISTIC_ACTIONS: readonly StatisticAction[] = [
  'rejected',
  'softRejected',
  'subjectRewritten',
  'movedToJunk',
  'noAction',
]

export interface StatisticRow {
  action: StatisticAction
  labelKey: string
  count: number
  /** The share of the total, from 0 to 1. */
  share: number
  /** The bar's width in percent of the track, from 0 to 100. */
  width: number
}

export const statisticLabelKey = (action: StatisticAction) =>
  `quarantineUi.statistics.actions.${action}`

/** The share of `count` in `total`; 0 for a zero total. */
export function shareOf(count: number, total: number): number {
  return total > 0 ? count / total : 0
}

export function statisticRows(stats: SpamFilterActionStatistics): StatisticRow[] {
  return STATISTIC_ACTIONS.map((action) => {
    const share = shareOf(stats[action], stats.total)
    return {
      action,
      labelKey: statisticLabelKey(action),
      count: stats[action],
      share,
      width: Math.min(100, Math.max(0, Math.round(share * 1000) / 10)),
    }
  })
}

/** A share as a percentage with one decimal (`Intl` percent, in the user's locale). */
export const SHARE_FORMAT: Intl.NumberFormatOptions = {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}
