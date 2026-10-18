// One result row of a bulk action (UI 002 data-model §2): the API's per-item outcome, or
// `skipped` (left out before sending), `unknown` (the connection was lost) and `notProcessed`
// (a sequential run stopped before the item).
import { ApiProblem, type BulkItemOutcome, type BulkResult } from '@/api'

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

/** An object of a bulk action: its identifier and its readable name. */
interface BulkEntry {
  name: string
  unicodeName: string
}

function labelOf(entries: readonly BulkEntry[], id: string): string {
  return entries.find((entry) => entry.name === id)?.unicodeName ?? id
}

/** One row per result, in request order, labelled by the readable name. */
export function rowsFromBulkResult(result: BulkResult, entries: readonly BulkEntry[]): BulkRow[] {
  return result.results.map((item) => ({
    id: item.id,
    label: labelOf(entries, item.id),
    outcome: item.outcome,
    problem: item.problem
      ? ApiProblem.fromParts({
          kind: 'problem',
          type: item.problem.type,
          status: item.problem.status,
          requestId: item.problem.requestId,
          extensions: Object.fromEntries(
            Object.entries(item.problem).filter(
              ([key]) => !['type', 'title', 'status', 'detail', 'requestId'].includes(key),
            ),
          ),
        })
      : undefined,
  }))
}

/** A lost connection: the outcome of every target is unknown (conventions "Bulk actions"). */
export function unknownRows(entries: readonly BulkEntry[]): BulkRow[] {
  return entries.map((entry) => ({ id: entry.name, label: entry.unicodeName, outcome: 'unknown' }))
}
