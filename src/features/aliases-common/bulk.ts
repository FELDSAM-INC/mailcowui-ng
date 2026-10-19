// The mass action building blocks of the UI 004 lists (data-model §2 `BulkActionConfig`, research
// R16): an action with legacy's label and its confirmation kind (none, one confirmation, the
// explanation of a copy, or the typed count), the targets with each list entry's version without
// quotes, as `BulkTarget.version` requires, and the items that stay selected (every one not done).
import type { BulkTarget } from '@/api'
import type { LegacyKey } from '@/i18n'
import type { BulkRow } from '@/shared/components/bulk-row'

export type BulkConfirm = 'none' | 'simple' | 'explain' | 'typedCount'

export interface BulkActionConfig<A extends string> {
  action: A
  labelKey: LegacyKey
  confirm: BulkConfirm
  destructive?: boolean
}

/** A version tag without its weak marker and quotes. */
export function unquote(etag: string): string {
  return etag.replace(/^W\//, '').replace(/^"(.*)"$/, '$1')
}

/** The targets of a mass action, from the list entries at send time (FR-026). */
export function toTargets<E extends { etag: string }>(
  entries: readonly E[],
  idOf: (entry: E) => string,
): BulkTarget[] {
  return entries.map((entry) => ({ id: idOf(entry), version: unquote(entry.etag) }))
}

/** Every item that is not done stays selected (research R16). */
export function retainedIds(rows: readonly BulkRow[]): string[] {
  return rows.filter((row) => row.outcome !== 'done').map((row) => row.id)
}
