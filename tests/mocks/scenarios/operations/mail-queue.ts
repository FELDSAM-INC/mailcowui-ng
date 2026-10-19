// MailQueue area of the operations scenarios (UI 011 T013): its data, its runtime changes, the seed
// data it contributes to `admin-operations`, and its own scenarios. Filled by US4.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MailQueueData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MailQueuePatch {}

export function initialMailQueueData(): MailQueueData {
  return {}
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.mailQueue`). */
export function applyMailQueuePatch(_state: ScenarioState, _patch: MailQueuePatch): void {}

/** The healthy installation's mailQueue data, seeded into every operations scenario. */
export function seedMailQueue(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const mailQueueScenarios: Record<string, ScenarioDefinition> = {}
