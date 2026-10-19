// Fail2ban area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US5.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Fail2banData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Fail2banPatch {}

export function initialFail2banData(): Fail2banData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.fail2ban`). */
export function applyFail2banPatch(_state: ScenarioState, _patch: Fail2banPatch): void {}

/** The healthy installation's fail2ban data, seeded into every operations scenario. */
export function seedFail2ban(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const fail2banScenarios: Record<string, ScenarioDefinition> = {}
