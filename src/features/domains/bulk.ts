// Bulk actions on domains (UI 002 research D22): targets with each entry's version tag, the
// domains a deletion skips, and the per-item rows of the result summary.
import type { BulkTarget } from '@/api'
import type { BulkRow } from '@/shared/components/bulk-row'

// Promoted to the shared bulk rows at their second use (UI 003); re-exported for UI 002's callers.
export { rowsFromBulkResult, unknownRows } from '@/shared/components/bulk-row'

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

export function skippedRows(
  entries: readonly Pick<BulkEntry, 'name' | 'unicodeName'>[],
): BulkRow[] {
  return entries.map((entry) => ({ id: entry.name, label: entry.unicodeName, outcome: 'skipped' }))
}
