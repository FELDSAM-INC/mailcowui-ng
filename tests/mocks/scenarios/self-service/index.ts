// UI 005's scenario modules (research R24): one per story, gathered here and spread into the
// registry (tests/mocks/scenarios/index.ts). Names start with `account-` so that they never clash
// with another feature's.
import type { ScenarioDefinition } from '../index'
import { accountScenarios } from './account'
import { ownPasswordScenarios } from './own-password'
import { twoFactorScenarios } from './two-factor'

export const selfServiceScenarioGroups: Record<string, ScenarioDefinition> = {
  ...accountScenarios,
  ...ownPasswordScenarios,
  ...twoFactorScenarios,
}
