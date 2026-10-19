// ContainerActions area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US2.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContainerActionsData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContainerActionsPatch {}

export function initialContainerActionsData(): ContainerActionsData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.containerActions`). */
export function applyContainerActionsPatch(
  _state: ScenarioState,
  _patch: ContainerActionsPatch,
): void {}

/** The healthy installation's containerActions data, seeded into every operations scenario. */
export function seedContainerActions(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const containerActionsScenarios: Record<string, ScenarioDefinition> = {}
