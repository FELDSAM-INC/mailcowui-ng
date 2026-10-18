// The mock API for Vitest (T027): msw/node with one scenario state at a time. Tests choose a
// scenario with `useScenario`, read or change it through `mockState()`, and the setup file resets
// it after each test and fails the test when the contract validator recorded a violation.
import { setupServer } from 'msw/node'

import { createHandlers } from './handlers'
import { createScenarioState, type ScenarioOverrides, type ScenarioState } from './scenarios'

let state: ScenarioState = createScenarioState('anonymous-default')

export const server = setupServer(...createHandlers(() => state))

export function mockState(): ScenarioState {
  return state
}

export function useScenario(name: string, overrides: ScenarioOverrides = {}): ScenarioState {
  state = createScenarioState(name, overrides)
  return state
}

export function resetMockState(): void {
  state = createScenarioState('anonymous-default')
}
