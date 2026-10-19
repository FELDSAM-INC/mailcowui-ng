// Rspamd area of the operations scenarios (UI 011 T013, T117): the statistics and the scan history
// of the healthy installation, and the scenarios of US6.
import type { RspamdHistoryEntry, RspamdStatistics } from '@/api'

import { rejectedEntry, rspamdHistory, rspamdStatistics } from '../../factories/rspamd'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface RspamdData {
  statistics: RspamdStatistics | null
  /** Newest first. */
  history: RspamdHistoryEntry[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RspamdPatch {}

export function initialRspamdData(): RspamdData {
  return { statistics: null, history: [] }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.rspamd`). */
export function applyRspamdPatch(_state: ScenarioState, _patch: RspamdPatch): void {}

/** The healthy installation: statistics of every action and 60 history entries. */
export function seedRspamd(state: ScenarioState): void {
  const now = state.now()
  state.operations.rspamd = {
    statistics: rspamdStatistics(new Date(now - 2_000).toISOString()),
    history: rspamdHistory(60, now - 120_000),
  }
}

const unavailable = { status: 503, problemType: 'temporary-failure', retryAfter: 30 }

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const rspamdScenarios: Record<string, ScenarioDefinition> = {
  'ops-rspamd': {
    description:
      'Rspamd statistics and history with a message from spammer@example.net that was rejected (UI 011 US6-AS1).',
    setup(state) {
      state.operations.rspamd.history.unshift(
        rejectedEntry(new Date(state.now() - 30_000).toISOString()),
      )
    },
  },
  'ops-rspamd-zero': {
    description: 'Rspamd has scanned no message yet: every action count is zero (UI 011 FR-046).',
    setup(state) {
      state.operations.rspamd.statistics = rspamdStatistics(
        new Date(state.now()).toISOString(),
        true,
      )
      state.operations.rspamd.history = []
    },
  },
  'ops-rspamd-unavailable': {
    description: 'The Rspamd controller cannot be reached (UI 011 US6-AS4).',
    setup(state) {
      state.operations.inject.getRspamdStatistics = { ...unavailable }
      state.operations.inject.listRspamdHistory = { ...unavailable }
    },
  },
}
