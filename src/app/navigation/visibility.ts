// Who sees and may open which catalogue entry (FR-043, FR-045, research R19). Hiding is a
// convenience: the API enforces permissions, and ShellLayout renders "no access" in place.
import type { Identity } from '@/api'

import { catalogue, findEntry, type NavigationEntry } from './catalogue'

function allowed(item: NavigationEntry, identity: Identity): boolean {
  const rule = item.access[identity.role]
  if (typeof rule === 'boolean') return rule
  return rule.anyFlag.some((flag) => identity.permissions[flag])
}

/** The entries the identity may see, in navigation order. */
export function visibleEntries(identity: Identity | null | undefined): NavigationEntry[] {
  if (!identity) return []
  return catalogue.filter((item) => allowed(item, identity))
}

/** Whether the identity may open the section of an entry. */
export function canAccess(entryId: string, identity: Identity | null | undefined): boolean {
  const item = findEntry(entryId)
  return !!item && !!identity && allowed(item, identity)
}

/**
 * UI 004 (research D16, docs/conventions.md "Where features meet"): whether a link into another
 * section may be shown: its entry is available in this version and the identity may open it.
 */
export function isEntryAvailable(entryId: string, identity: Identity | null | undefined): boolean {
  const item = findEntry(entryId)
  return !!item && item.status === 'available' && canAccess(entryId, identity)
}
