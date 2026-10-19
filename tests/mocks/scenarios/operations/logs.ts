// Logs area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US3.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LogsData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LogsPatch {}

export function initialLogsData(): LogsData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.logs`). */
export function applyLogsPatch(_state: ScenarioState, _patch: LogsPatch): void {}

/** The healthy installation's logs data, seeded into every operations scenario. */
export function seedLogs(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const logsScenarios: Record<string, ScenarioDefinition> = {}
