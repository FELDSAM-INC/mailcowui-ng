// UI 005's scenario modules (research R24): one per story, gathered here and spread into the
// registry (tests/mocks/scenarios/index.ts). Names start with `account-` so that they never clash
// with another feature's.
import type { ScenarioDefinition } from '../index'
import { appPasswordScenarios } from './app-passwords'
import { accountScenarios } from './account'
import { ownPasswordScenarios } from './own-password'
import { passwordResetScenarios } from './password-reset'
import { twoFactorScenarios } from './two-factor'

export const selfServiceScenarioGroups: Record<string, ScenarioDefinition> = {
  ...accountScenarios,
  ...appPasswordScenarios,
  ...ownPasswordScenarios,
  ...twoFactorScenarios,
  ...passwordResetScenarios,
}
