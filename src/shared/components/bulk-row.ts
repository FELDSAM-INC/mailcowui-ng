// One result row of a bulk action (UI 002 data-model §2): the API's per-item outcome, or
// `skipped` (left out before sending), `unknown` (the connection was lost) and `notProcessed`
// (a sequential run stopped before the item).
import type { ApiProblem, BulkItemOutcome } from '@/api'

export type BulkRowOutcome = BulkItemOutcome | 'skipped' | 'unknown' | 'notProcessed'

export interface BulkRow {
  id: string
  /** The readable name of the object. */
  label: string
  outcome: BulkRowOutcome
  problem?: ApiProblem
}

export const ROW_OUTCOMES: readonly BulkRowOutcome[] = [
  'done',
  'notFound',
  'refused',
  'outdated',
  'failed',
  'skipped',
  'unknown',
  'notProcessed',
]

/** Failed, refused and outdated items stay selected and can be retried (conventions). */
export function isRetryable(row: BulkRow): boolean {
  return row.outcome === 'failed' || row.outcome === 'refused' || row.outcome === 'outdated'
}

export function outcomeCounts(rows: readonly BulkRow[]): Partial<Record<BulkRowOutcome, number>> {
  const counts: Partial<Record<BulkRowOutcome, number>> = {}
  for (const row of rows) counts[row.outcome] = (counts[row.outcome] ?? 0) + 1
  return counts
}
