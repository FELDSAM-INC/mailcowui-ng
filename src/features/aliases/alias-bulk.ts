// The mass actions of the UI 004 lists (data-model §2 `BulkActionConfig`, research R16): each
// action with legacy's label (`mailbox.activate`, `mailbox.deactivate`, `mailbox.sogo_visible_y`,
// `mailbox.sogo_visible_n`, `mailbox.add_alias_expand`, `mailbox.remove`) and its confirmation:
// none for activate and show, one for deactivate and hide, the explanation for the copy and the
// typed count for delete. Targets carry each list entry's version without quotes, as
// `BulkTarget.version` requires; every item that is not done stays selected.
import type { AliasBulkActionRequest, BulkTarget } from '@/api'
import type { LegacyKey } from '@/i18n'
import type { BulkRow } from '@/shared/components/bulk-row'

import type { Feature004Permissions } from './permissions'

export type BulkConfirm = 'none' | 'simple' | 'explain' | 'typedCount'

export interface BulkActionConfig<A extends string> {
  action: A
  labelKey: LegacyKey
  confirm: BulkConfirm
  destructive?: boolean
}

export type AliasBulkAction = AliasBulkActionRequest['action']

const ALIAS_ACTIONS: (BulkActionConfig<AliasBulkAction> & { groupware?: boolean })[] = [
  { action: 'activate', labelKey: 'mailbox.activate', confirm: 'none' },
  { action: 'deactivate', labelKey: 'mailbox.deactivate', confirm: 'simple' },
  {
    action: 'showInGroupware',
    labelKey: 'mailbox.sogo_visible_y',
    confirm: 'none',
    groupware: true,
  },
  {
    action: 'hideInGroupware',
    labelKey: 'mailbox.sogo_visible_n',
    confirm: 'simple',
    groupware: true,
  },
  { action: 'copyOverAliasDomains', labelKey: 'mailbox.add_alias_expand', confirm: 'explain' },
  { action: 'delete', labelKey: 'mailbox.remove', confirm: 'typedCount', destructive: true },
]

/** The alias mass actions the user may run (FR-057). */
export function aliasBulkActions(
  permissions: Feature004Permissions,
  capabilities: { groupwareEnabled: boolean | undefined },
): BulkActionConfig<AliasBulkAction>[] {
  if (!permissions.canManageAliases) return []
  return ALIAS_ACTIONS.filter(
    (item) => !item.groupware || capabilities.groupwareEnabled === true,
  ).map(({ groupware: _groupware, ...item }) => item)
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
