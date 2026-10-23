// UI 013 T009: documented server defaults, generated types and a fresh object per scenario.
import type { SettingsCapabilities } from '@/api'

export function settingsCapabilities(
  overrides: Partial<SettingsCapabilities> = {},
): SettingsCapabilities {
  return {
    hostname: 'mail.example.org',
    demoMode: false,
    licenseVerificationEnabled: true,
    rspamdWebInterfaceUrl: '/rspamd/',
    logos: {
      acceptedMediaTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
      maxBytes: 15 * 1024 * 1024,
      maxWidth: 1920,
      maxHeight: 1920,
    },
    brandColors: {
      lightReferenceSurface: '#ffffff',
      darkReferenceSurface: '#222932',
      minimumContrastRatio: 4.5,
    },
    limits: {
      singleLineTextMaxLength: 255,
      htmlTextMaxLength: 65_535,
      templateMaxBytes: 1_048_576,
      appLinksMax: 50,
      quotaNotificationRecipientsMax: 100,
      corsOriginsMax: 100,
      passwordPolicyMinLength: 3,
      passwordPolicyMaxLength: 64,
      rspamdUiPasswordMinLength: 6,
      rspamdUiPasswordMaxLength: 256,
      rspamdRuleContentMaxBytes: 1_048_576,
      rspamdRegexMapMaxBytes: 1_048_576,
      sieveScriptMaxBytes: 1_048_576,
      defaultPageSize: 25,
      maxPageSize: 1000,
    },
    massMail: {
      suggestedSender: 'noreply@mail.example.org',
      ratePerSecond: 10,
      maxRunningJobs: 1,
      maxRetries: 3,
      retryWindowSeconds: 300,
      maxSelectionEntries: 1000,
      maxBodyBytes: 1_048_576,
    },
    ...overrides,
  }
}
