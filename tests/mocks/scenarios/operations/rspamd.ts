// Rspamd area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US6.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RspamdData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RspamdPatch {}

export function initialRspamdData(): RspamdData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.rspamd`). */
export function applyRspamdPatch(_state: ScenarioState, _patch: RspamdPatch): void {}

/** The healthy installation's rspamd data, seeded into every operations scenario. */
export function seedRspamd(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const rspamdScenarios: Record<string, ScenarioDefinition> = {}
