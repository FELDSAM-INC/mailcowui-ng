// Bulk actions on domains (UI 002 research D22): targets with each entry's version tag, the
// domains a deletion skips, and the per-item rows of the result summary.
import { ApiProblem, type BulkResult, type BulkTarget } from '@/api'
import type { BulkRow } from '@/shared/components/bulk-row'

export interface BulkEntry {
  name: string
  unicodeName: string
  etag: string
  usage: { mailboxes: number; resources: number }
}

/** `BulkTarget.version` is the entry's `etag` exactly as read, quotes included (API gap G33). */
export function toBulkTargets(entries: readonly Pick<BulkEntry, 'name' | 'etag'>[]): BulkTarget[] {
  return entries.map((entry) => ({ id: entry.name, version: entry.etag }))
}

/** Domains with mailboxes or resources are never sent for deletion (FR-047). */
export function partitionDeletable<T extends Pick<BulkEntry, 'usage'>>(
  entries: readonly T[],
): { deletable: T[]; skipped: T[] } {
  const deletable: T[] = []
  const skipped: T[] = []
  for (const entry of entries) {
    if (entry.usage.mailboxes + entry.usage.resources > 0) skipped.push(entry)
    else deletable.push(entry)
  }
  return { deletable, skipped }
}

function labelOf(entries: readonly Pick<BulkEntry, 'name' | 'unicodeName'>[], id: string): string {
  return entries.find((entry) => entry.name === id)?.unicodeName ?? id
}

/** One row per result, in request order, labelled by the readable name. */
export function rowsFromBulkResult(
  result: BulkResult,
  entries: readonly Pick<BulkEntry, 'name' | 'unicodeName'>[],
): BulkRow[] {
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

export function skippedRows(
  entries: readonly Pick<BulkEntry, 'name' | 'unicodeName'>[],
): BulkRow[] {
  return entries.map((entry) => ({ id: entry.name, label: entry.unicodeName, outcome: 'skipped' }))
}

/** A lost connection: the outcome of every target is unknown (conventions "Bulk actions"). */
export function unknownRows(
  entries: readonly Pick<BulkEntry, 'name' | 'unicodeName'>[],
): BulkRow[] {
  return entries.map((entry) => ({ id: entry.name, label: entry.unicodeName, outcome: 'unknown' }))
}
