// The bulk actions of the DKIM list (FR-040, research R8, R9; legacy's multi-select "Remove" and the
// add form): generation for names without a key (both roles) and deletion of keys
// (administrators). Entries an action does not apply to are listed as skipped.
import type { DkimKey, Role } from '@/api'
import { lt } from '@/i18n'
import type { BulkAction } from '@/shared/components/BulkActionBar.vue'

export type DkimBulkActionId = 'generate' | 'delete'

/** The bar's actions for a role, with the classic interface's labels. */
export function dkimBulkActions(role: Role | undefined): BulkAction[] {
  const actions: BulkAction[] = []
  if (role === 'admin' || role === 'domainAdmin') {
    actions.push({ id: 'generate', label: lt('admin.dkim_add_key') })
  }
  if (role === 'admin') actions.push({ id: 'delete', label: lt('admin.remove'), destructive: true })
  return actions
}

/** The entries an action applies to, and the ones it skips. */
export function splitSelection(
  entries: readonly DkimKey[],
  action: DkimBulkActionId,
): { targets: DkimKey[]; skipped: DkimKey[] } {
  const applies = (entry: DkimKey) =>
    action === 'generate' ? entry.state === 'missing' : entry.key !== null
  return {
    targets: entries.filter(applies),
    skipped: entries.filter((entry) => !applies(entry)),
  }
}
