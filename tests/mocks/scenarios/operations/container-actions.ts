// Container actions area of the operations scenarios (UI 011 T013, T061): an outcome per container
// for start, stop and restart (a delay, a documented problem, a missing audit record, a container
// removed before the action), and the scenario `ops-container-actions`.
import type { ContainerAction } from '@/api'

import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface ContainerOutcome {
  /** Only for this action; every action when omitted. */
  action?: ContainerAction
  delayMs?: number
  /** A problem answer instead of the action (`container` is added for container problems). */
  problem?: { status: number; problemType: string; extensions?: Record<string, unknown> }
  /** The action is carried out even though the answer is a problem (a timeout after the change). */
  carriedOut?: boolean
  auditRecorded?: false
  /** The container disappears before the action: 404. */
  removed?: boolean
  /** How often the outcome applies (default: always). */
  times?: number
}

export interface ContainerActionsData {
  outcomes: Record<string, ContainerOutcome>
}

export interface ContainerActionsPatch {
  /** Sets outcomes by container name; `null` removes one. */
  outcomes?: Record<string, ContainerOutcome | null>
}

export function initialContainerActionsData(): ContainerActionsData {
  return { outcomes: {} }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.containerActions`). */
export function applyContainerActionsPatch(
  state: ScenarioState,
  patch: ContainerActionsPatch,
): void {
  const outcomes = state.operations.containerActions.outcomes
  for (const [name, outcome] of Object.entries(patch.outcomes ?? {})) {
    if (outcome === null) delete outcomes[name]
    else outcomes[name] = { ...outcome }
  }
}

/** The healthy installation has no special outcomes. */
export function seedContainerActions(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const containerActionsScenarioDefinitions: Record<string, ScenarioDefinition> = {
  'ops-container-actions': {
    description:
      'An outcome per container: SOGo restarts after 3 s, olefy times out, memcached refuses to stop, Redis restarts without an audit record, ACME was removed, watchdog is restarting and ofelia paused (UI 011 US2).',
    setup(state) {
      const outcomes = state.operations.containerActions.outcomes
      outcomes['sogo-mailcow'] = { delayMs: 3000 }
      outcomes['olefy-mailcow'] = {
        action: 'restart',
        problem: { status: 504, problemType: 'outcome-unknown', extensions: { step: 'restart' } },
        carriedOut: true,
      }
      outcomes['memcached-mailcow'] = {
        action: 'stop',
        problem: {
          status: 502,
          problemType: 'container-action-failed',
          extensions: { serviceMessage: 'Cannot kill container: memcached-mailcow is busy' },
        },
      }
      outcomes['redis-mailcow'] = { action: 'restart', auditRecorded: false }
      outcomes['acme-mailcow'] = { removed: true }
      for (const container of state.operations.dashboard.containers) {
        if (container.name === 'watchdog-mailcow') container.state = 'restarting'
        if (container.name === 'ofelia-mailcow') container.state = 'paused'
      }
    },
  },
}
