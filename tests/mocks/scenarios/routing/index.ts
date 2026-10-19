// The routing scenarios (UI 009 T006): one module per area, so that the stories never edit the same
// seed; `routing-admin-default` is composed from every area's seed.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { assignmentScenarios } from './assignments'
import { routingBaseScenarios } from './base'
import { bccMapScenarios, seedBccMaps } from './bcc-maps'
import { connectionTestScenarios } from './connection-tests'
import { seedForwardingHosts } from './forwarding-hosts'
import { seedRecipientMaps } from './recipient-maps'
import { relayhostScenarios, seedRelayhosts } from './relayhosts'
import { seedTlsPolicyMaps } from './tls-policy-maps'
import { seedTransports, transportScenarios } from './transports'

/** Every area's seed: the data of `routing-admin-default`. */
export function seedRouting(state: ScenarioState): void {
  seedRelayhosts(state)
  seedTransports(state)
  seedBccMaps(state)
  seedRecipientMaps(state)
  seedTlsPolicyMaps(state)
  seedForwardingHosts(state)
}

export const routingScenarios: Record<string, ScenarioDefinition> = {
  ...routingBaseScenarios(seedRouting),
  ...relayhostScenarios,
  ...assignmentScenarios,
  ...transportScenarios,
  ...connectionTestScenarios,
  ...bccMapScenarios,
}
