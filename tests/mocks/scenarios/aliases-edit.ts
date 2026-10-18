// UI 004 US3 scenarios (T050): changing and deleting aliases. Changes and deletions behind the
// app's back use `PATCH /__mock/scenarios/:id` (`changeElsewhere`, `deleteElsewhere`).
import { mockAlias } from '../factories/alias'
import {
  ALIAS_004,
  DOMAIN_ADMIN_004,
  MAILBOX_004,
  RESOURCE_004,
  setupWorld004,
  syncUsage004,
} from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export const EDIT_ALIAS_004 = {
  /** sales@example.org → anna (US3-AS1). */
  sales: ALIAS_004.sales,
  /** partners@example.org → anna and ext@partner.example, an external destination an administrator set. */
  partners: 20,
  /** notes@example.org with a 300-byte private comment stored by another tool. */
  notes: 21,
  /** rooms@example.org → MeetingRoom1@example.org, a resource stored as destination by another tool. */
  rooms: 22,
  /** @example.org → anna (catch-all). */
  catchAll: ALIAS_004.catchAll,
  /** lost@gone.example (orphaned). */
  orphaned: ALIAS_004.orphaned,
} as const

/** 150 two-byte characters: 300 bytes in UTF-8. */
export const LONG_COMMENT_004 = 'é'.repeat(150)

function setupAliasEdit(state: ScenarioState): void {
  setupWorld004(state)
  state.aliases.find((alias) => alias.id === ALIAS_004.sales)!.destinations = [MAILBOX_004.anna]
  state.aliases.push(
    mockAlias({
      id: EDIT_ALIAS_004.partners,
      address: 'partners@example.org',
      destinations: [MAILBOX_004.anna, 'ext@partner.example'],
    }),
    mockAlias({
      id: EDIT_ALIAS_004.notes,
      address: 'notes@example.org',
      destinations: [MAILBOX_004.bob],
      privateComment: LONG_COMMENT_004,
    }),
    mockAlias({
      id: EDIT_ALIAS_004.rooms,
      address: 'rooms@example.org',
      destinations: [RESOURCE_004.meetingRoom],
    }),
  )
  state.lastAliasId = Math.max(...state.aliases.map((alias) => alias.id))
  syncUsage004(state)
}

export const aliasesEditScenarios: Record<string, ScenarioDefinition> = {
  'aliases-edit': {
    description:
      'An administrator with sales@example.org → anna, an alias with an external destination, a 300-byte stored comment, a resource as stored destination, a catch-all and an orphaned alias (UI 004 US3).',
    overrides: { signedInAs: 'admin' },
    setup: setupAliasEdit,
  },
  'aliases-edit-da': {
    description:
      'The same aliases as the domain administrator of example.org and example.com without aliasExternalGoto (US3-AS3).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: setupAliasEdit,
  },
}
