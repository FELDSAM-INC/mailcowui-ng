// Dashboard area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US1.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardPatch {}

export function initialDashboardData(): DashboardData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.dashboard`). */
export function applyDashboardPatch(_state: ScenarioState, _patch: DashboardPatch): void {}

/** The healthy installation's dashboard data, seeded into every operations scenario. */
export function seedDashboard(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const dashboardScenarios: Record<string, ScenarioDefinition> = {}
