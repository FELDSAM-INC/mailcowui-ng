// Updates area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US7.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdatesData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdatesPatch {}

export function initialUpdatesData(): UpdatesData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.updates`). */
export function applyUpdatesPatch(_state: ScenarioState, _patch: UpdatesPatch): void {}

/** The healthy installation's updates data, seeded into every operations scenario. */
export function seedUpdates(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const updatesScenarios: Record<string, ScenarioDefinition> = {}
