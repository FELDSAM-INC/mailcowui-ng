// UI 013 R30: only data used by implemented settings is seeded; later slices extend this store.
import type { IpCheckSetting, PasswordResetNotification, SettingsCapabilities } from '@/api'

import { settingsCapabilities } from '../factories/settings'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export interface SettingsState {
  capabilities: SettingsCapabilities
  ipCheck: IpCheckSetting
  passwordReset: PasswordResetNotification
  revision: number
}
export interface SettingsPatch {
  capabilities?: Partial<SettingsCapabilities>
  ipCheck?: Partial<IpCheckSetting>
  passwordReset?: Partial<PasswordResetNotification>
}
export function initialSettingsState(): SettingsState {
  return {
    capabilities: settingsCapabilities(),
    ipCheck: { enabled: false, etag: '"ip-check-1"' },
    passwordReset: {
      sender: '',
      subject: '',
      textTemplate: '',
      htmlTemplate: '',
      templatesAreDefault: true,
      passwordResetAvailable: false,
      etag: '"password-reset-1"',
    },
    revision: 1,
  }
}
export function applySettingsPatch(state: ScenarioState, patch: SettingsPatch): void {
  if (patch.ipCheck) Object.assign(state.settings.ipCheck, patch.ipCheck)
  if (patch.passwordReset) Object.assign(state.settings.passwordReset, patch.passwordReset)
  if (patch.capabilities) Object.assign(state.settings.capabilities, patch.capabilities)
}

export const systemSettingsScenarios: Record<string, ScenarioDefinition> = {
  'password-defaults': {
    description: 'The default password policy and reset templates.',
    overrides: { signedInAs: 'admin' },
  },
  'password-reset-available': {
    description: 'Reset is available with the default templates.',
    overrides: {
      signedInAs: 'admin',
      settings: {
        passwordReset: { sender: 'no-reply@example.org', subject: 'Reset your password' },
      },
    },
  },
  'password-reset-custom': {
    description: 'Reset uses custom templates.',
    overrides: {
      signedInAs: 'admin',
      settings: {
        passwordReset: {
          sender: 'no-reply@example.org',
          subject: 'Reset your password',
          textTemplate: 'Reset here: {{link}}',
          htmlTemplate: '<p>Reset here: <a href="{{link}}">{{link}}</a></p>',
        },
      },
    },
  },
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
