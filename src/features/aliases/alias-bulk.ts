// The mass actions of the UI 004 lists (data-model §2 `BulkActionConfig`, research R16): each
// action with legacy's label (`mailbox.activate`, `mailbox.deactivate`, `mailbox.sogo_visible_y`,
// `mailbox.sogo_visible_n`, `mailbox.add_alias_expand`, `mailbox.remove`) and its confirmation:
// none for activate and show, one for deactivate and hide, the explanation for the copy and the
// typed count for delete (the building blocks are in `aliases-common`).
import type { AliasBulkActionRequest } from '@/api'
import type { BulkActionConfig, Feature004Permissions } from '@/features/aliases-common'

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
