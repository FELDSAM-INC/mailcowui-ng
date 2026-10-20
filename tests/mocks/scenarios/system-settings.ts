import { settingsAuditRecords } from '../factories/settings-audit'
import { mockDomain } from '../factories/domain'
import { assignDomains } from './domains-base'
// UI 013 R30: only data used by implemented settings is seeded; later slices extend this store.
import type {
  IpCheckSetting,
  LegacyApiCorsSettings,
  LicenseStatus,
  GlobalSieveFilter,
  DovecotRestartOutcome,
  PasswordResetNotification,
  SettingsCapabilities,
  QuotaNotificationSettings,
  QuotaNotificationRecipients,
} from '@/api'
import { regexMaps } from '../factories/regex-map'
import type { RspamdRegexMap } from '@/api'

import { settingsCapabilities } from '../factories/settings'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export interface SettingsState {
  cors: LegacyApiCorsSettings
  license: LicenseStatus
  licenseResult: LicenseStatus['lastVerification']['result']
  globalFilters: GlobalSieveFilter[]
  missingGlobalFilters: string[]
  globalRestart: DovecotRestartOutcome['outcome']
  restartCount: number
  capabilities: SettingsCapabilities
  ipCheck: IpCheckSetting
  passwordReset: PasswordResetNotification
  quota: QuotaNotificationSettings
  quotaCopies: Record<string, QuotaNotificationRecipients>
  regexMaps: RspamdRegexMap[]
  revision: number
}
export interface SettingsPatch {
  cors?: Partial<LegacyApiCorsSettings>
  license?: Partial<LicenseStatus>
  licenseResult?: LicenseStatus['lastVerification']['result']
  globalFilters?: GlobalSieveFilter[]
  missingGlobalFilters?: string[]
  globalRestart?: DovecotRestartOutcome['outcome']
  regexMaps?: RspamdRegexMap[]
  capabilities?: Partial<SettingsCapabilities>
  ipCheck?: Partial<IpCheckSetting>
  passwordReset?: Partial<PasswordResetNotification>
  quota?: Partial<QuotaNotificationSettings>
  quotaCopies?: Record<string, QuotaNotificationRecipients>
}
export function initialSettingsState(): SettingsState {
  return {
    cors: {
      allowedOrigins: [],
      allowedMethods: ['POST', 'GET', 'DELETE', 'PUT'],
      serverOrigin: 'https://mail.example.org',
      etag: '"cors-1"',
    },
    license: {
      guid: 'a'.repeat(64),
      guidValid: true,
      lastVerification: {
        result: 'valid',
        verifiedAt: '2026-10-20T10:00:00Z',
        customerId: 'customer-123',
        serviceId: 'service-456',
        supportLevel: 2,
      },
    },
    licenseResult: 'valid',
    globalFilters: [
      { id: 'prefilter', script: 'keep;\n', etag: '"global-pre-1"' },
      {
        id: 'postfilter',
        script: 'require "fileinto";\nfileinto "Junk";\n',
        etag: '"global-post-1"',
      },
    ],
    missingGlobalFilters: [],
    globalRestart: 'done',
    restartCount: 0,
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
    quota: {
      sender: '',
      subject: '',
      htmlTemplate: '',
      senderIsDefault: true,
      subjectIsDefault: true,
      htmlTemplateIsDefault: true,
      etag: '"quota-1"',
    },
    quotaCopies: {
      'example.net': {
        domain: 'example.net',
        recipients: ['retained@example.net'],
        active: true,
        etag: '"copies-net-1"',
      },
    },
    revision: 1,
    regexMaps: regexMaps(),
  }
}
export function applySettingsPatch(state: ScenarioState, patch: SettingsPatch): void {
  if (patch.cors) Object.assign(state.settings.cors, patch.cors)
  if (patch.license) Object.assign(state.settings.license, patch.license)
  if (patch.licenseResult) state.settings.licenseResult = patch.licenseResult
  if (patch.globalFilters) state.settings.globalFilters = patch.globalFilters
  if (patch.missingGlobalFilters) state.settings.missingGlobalFilters = patch.missingGlobalFilters
  if (patch.globalRestart) state.settings.globalRestart = patch.globalRestart
  if (patch.quota) Object.assign(state.settings.quota, patch.quota)
  if (patch.quotaCopies) Object.assign(state.settings.quotaCopies, patch.quotaCopies)
  if (patch.regexMaps) state.settings.regexMaps = patch.regexMaps
  if (patch.ipCheck) Object.assign(state.settings.ipCheck, patch.ipCheck)
  if (patch.passwordReset) Object.assign(state.settings.passwordReset, patch.passwordReset)
  if (patch.capabilities) Object.assign(state.settings.capabilities, patch.capabilities)
}

export const systemSettingsScenarios: Record<string, ScenarioDefinition> = {
  'audit-settings-records': {
    description: 'Every settings audit kind and representative refusals',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      state.auditEvents = settingsAuditRecords(state.now())
    },
  },
  'cors-legacy-bare-host': {
    description: 'Stored legacy CORS origin needs correction',
    overrides: { signedInAs: 'admin', settings: { cors: { allowedOrigins: ['old.example.org'] } } },
  },
  'settings-license-valid': { description: 'A valid license', overrides: { signedInAs: 'admin' } },
  'settings-license-unreachable': {
    description: 'Verification service unreachable',
    overrides: { signedInAs: 'admin', settings: { licenseResult: 'unreachable' } },
  },
  'settings-license-guid-invalid': {
    description: 'GUID marked invalid',
    overrides: {
      signedInAs: 'admin',
      settings: { license: { guid: null, guidValid: false }, licenseResult: 'invalid' },
    },
  },
  'global-sieve-default': {
    description: 'Global Sieve scripts',
    overrides: { signedInAs: 'admin' },
  },
  'global-sieve-restart-fails': {
    description: 'Saved script with failed restart',
    overrides: { signedInAs: 'admin', settings: { globalRestart: 'failed' } },
  },
  'global-sieve-file-missing': {
    description: 'Global post-filter file absent',
    overrides: { signedInAs: 'admin', settings: { missingGlobalFilters: ['postfilter'] } },
  },
  'quota-defaults': {
    setup: setupQuotaDomains,
    description: 'Default quota notifications.',
    overrides: { signedInAs: 'admin' },
  },
  'quota-custom': {
    description: 'Custom quota notification.',
    overrides: {
      signedInAs: 'admin',
      settings: {
        quota: {
          sender: 'support@example.org',
          subject: 'Storage warning',
          htmlTemplate: '<p>{{username}} {{percent}}</p>',
        },
      },
    },
  },
  'quota-copies-example-org': {
    setup: setupQuotaDomains,
    description: 'Domain administrator quota copies.',
    overrides: {
      signedInAs: 'reseller',
      accounts: { reseller: { scope: { type: 'domains', domains: ['example.org'] } } },
    },
  },
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
  'filter-maps-13': {
    description: 'Thirteen configured maps, including one unavailable map.',
    overrides: { signedInAs: 'admin' },
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

function setupQuotaDomains(state: ScenarioState) {
  state.domains = [mockDomain({ name: 'example.org' }), mockDomain({ name: 'example.net' })]
  assignDomains(state, 'reseller', ['example.org'])
}
