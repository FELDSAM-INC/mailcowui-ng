// UI 013 R30: only data used by implemented settings is seeded; later slices extend this store.
import type { IpCheckSetting, SettingsCapabilities } from '@/api'

import { settingsCapabilities } from '../factories/settings'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export interface SettingsState {
  capabilities: SettingsCapabilities
  ipCheck: IpCheckSetting
  revision: number
}
export interface SettingsPatch {
  capabilities?: Partial<SettingsCapabilities>
  ipCheck?: Partial<IpCheckSetting>
}
export function initialSettingsState(): SettingsState {
  return {
    capabilities: settingsCapabilities(),
    ipCheck: { enabled: false, etag: '"ip-check-1"' },
    revision: 1,
  }
}
export function applySettingsPatch(state: ScenarioState, patch: SettingsPatch): void {
  if (patch.ipCheck) Object.assign(state.settings.ipCheck, patch.ipCheck)
  if (patch.capabilities) Object.assign(state.settings.capabilities, patch.capabilities)
}

export const systemSettingsScenarios: Record<string, ScenarioDefinition> = {
  'settings-admin-defaults': {
    description: 'System settings with the server defaults.',
    overrides: { signedInAs: 'admin' },
  },
  'settings-domain-admin': {
    description: 'A domain administrator cannot enter system settings.',
    overrides: { signedInAs: 'reseller' },
  },
  'settings-mailbox-user': {
    description: 'A mailbox user cannot enter system settings.',
    overrides: { signedInAs: 'alice@example.org' },
  },
  'settings-capabilities-error': {
    description: 'The settings capabilities fail until the injected failure is removed.',
    overrides: { signedInAs: 'admin', failures: { getSettingsCapabilities: { status: 500 } } },
  },
  'settings-demo-mode': {
    description: 'Branding and IP check changes are disabled on the demonstration server.',
    overrides: { signedInAs: 'admin', settings: { capabilities: { demoMode: true } } },
  },
  'settings-license-disabled': {
    description: 'The operator disabled license verification.',
    overrides: {
      signedInAs: 'admin',
      settings: { capabilities: { licenseVerificationEnabled: false } },
    },
  },
}
