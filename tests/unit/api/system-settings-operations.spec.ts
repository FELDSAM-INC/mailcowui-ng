// UI 013 T002: a later contract pin must retain each consumed operation and its outcomes.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const contract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as {
  paths: Record<string, Record<string, { operationId: string; responses: Record<string, unknown> }>>
}

const expected = [
  ['getSettingsCapabilities', 'get', '/capabilities/settings', '200,401,403,500'],
  ['getLogoSetting', 'get', '/settings/logos/{variant}', '200,401,403,500,503'],
  ['replaceLogo', 'put', '/settings/logos/{variant}', '200,400,401,403,412,422,500,503'],
  ['deleteLogo', 'delete', '/settings/logos/{variant}', '204,401,403,412,500,503'],
  ['getUiTexts', 'get', '/settings/ui-texts', '200,401,403,500,503'],
  ['updateUiTexts', 'patch', '/settings/ui-texts', '200,400,401,403,412,422,500,503'],
  ['getLoginPageSettings', 'get', '/settings/login-page', '200,401,403,500,503'],
  ['updateLoginPageSettings', 'patch', '/settings/login-page', '200,400,401,403,412,422,500,503'],
  ['getAppLinkSettings', 'get', '/settings/app-links', '200,401,403,500,503'],
  ['updateAppLinkSettings', 'patch', '/settings/app-links', '200,400,401,403,412,422,500,503'],
  ['getBrandColors', 'get', '/settings/brand-colors', '200,401,403,500,503'],
  ['updateBrandColors', 'patch', '/settings/brand-colors', '200,400,401,403,412,422,500,503'],
  ['getIpCheckSetting', 'get', '/settings/ip-check', '200,401,403,500,503'],
  ['updateIpCheckSetting', 'patch', '/settings/ip-check', '200,400,401,403,412,422,500,503'],
  ['updatePasswordPolicy', 'patch', '/password-policy', '200,400,401,403,412,422,500,503'],
  [
    'getPasswordResetNotification',
    'get',
    '/settings/password-reset-notification',
    '200,401,403,500,503',
  ],
  [
    'updatePasswordResetNotification',
    'patch',
    '/settings/password-reset-notification',
    '200,400,401,403,412,422,500,503',
  ],
  ['getQuotaNotificationSettings', 'get', '/settings/quota-notification', '200,401,403,500,503'],
  [
    'updateQuotaNotificationSettings',
    'patch',
    '/settings/quota-notification',
    '200,400,401,403,412,422,500,503',
  ],
  [
    'getQuotaNotificationRecipients',
    'get',
    '/domains/{domain}/quota-notification-recipients',
    '200,401,403,404,500,503',
  ],
  [
    'updateQuotaNotificationRecipients',
    'patch',
    '/domains/{domain}/quota-notification-recipients',
    '200,400,401,403,404,412,422,500,503',
  ],
  ['listRspamdSettingsRules', 'get', '/settings/rspamd-rules', '200,401,403,422,500'],
  ['createRspamdSettingsRule', 'post', '/settings/rspamd-rules', '200,201,400,401,403,422,500'],
  ['getRspamdSettingsRule', 'get', '/settings/rspamd-rules/{ruleId}', '200,401,403,404,500'],
  [
    'updateRspamdSettingsRule',
    'patch',
    '/settings/rspamd-rules/{ruleId}',
    '200,400,401,403,404,412,422,500',
  ],
  [
    'deleteRspamdSettingsRule',
    'delete',
    '/settings/rspamd-rules/{ruleId}',
    '204,401,403,404,412,500',
  ],
  ['getEffectiveRspamdSettingsMap', 'get', '/settings/rspamd-settings-map', '200,401,403,500,503'],
  ['listRspamdRegexMaps', 'get', '/settings/rspamd-regex-maps', '200,401,403,422,500'],
  ['getRspamdRegexMap', 'get', '/settings/rspamd-regex-maps/{mapId}', '200,401,403,404,500'],
  [
    'replaceRspamdRegexMap',
    'put',
    '/settings/rspamd-regex-maps/{mapId}',
    '200,400,401,403,404,409,412,422,500',
  ],
  ['setRspamdUiPassword', 'put', '/settings/rspamd-ui-password', '204,400,401,403,422,500,502,504'],
  ['listGlobalSieveFilters', 'get', '/settings/global-sieve-filters', '200,401,403,422,500'],
  [
    'replaceGlobalSieveFilter',
    'put',
    '/settings/global-sieve-filters/{filterId}',
    '200,400,401,403,409,412,422,500',
  ],
  ['listPresets', 'get', '/presets/{presetKind}', '200,401,403,404,422,500'],
  ['getLegacyApiCorsSettings', 'get', '/settings/legacy-api-cors', '200,401,403,500,503'],
  [
    'updateLegacyApiCorsSettings',
    'patch',
    '/settings/legacy-api-cors',
    '200,400,401,403,412,422,500,503',
  ],
  [
    'previewMassMailRecipients',
    'post',
    '/mass-mail-jobs/recipient-preview',
    '200,400,401,403,422,500',
  ],
  ['createMassMailJob', 'post', '/mass-mail-jobs', '201,400,401,403,409,422,500'],
  ['listMassMailJobs', 'get', '/mass-mail-jobs', '200,401,403,422,500'],
  ['getMassMailJob', 'get', '/mass-mail-jobs/{jobId}', '200,401,403,404,500'],
  [
    'listMassMailJobRecipients',
    'get',
    '/mass-mail-jobs/{jobId}/recipients',
    '200,401,403,404,422,500',
  ],
  ['cancelMassMailJob', 'post', '/mass-mail-jobs/{jobId}/cancellation', '200,401,403,404,409,500'],
  ['getLicenseStatus', 'get', '/license', '200,401,403,500,503'],
  ['verifyLicense', 'post', '/license/verification', '200,401,403,500,503'],
  ['getPasswordPolicy', 'get', '/password-policy', '200,401,403,500,503'],
  ['getPublicConfig', 'get', '/public-config', '200,304,401,403,500'],
  ['getPublicConfigLogo', 'get', '/public-config/logos/{variant}', '200,304,401,403,404,500'],
  ['listAuditEvents', 'get', '/audit-events', '200,401,403,422,500'],
  ['getIdentity', 'get', '/me', '200,401,403,500'],
  ['listDomains', 'get', '/domains', '200,401,403,422,500'],
  ['listMailboxes', 'get', '/mailboxes', '200,401,403,422,500,503'],
] as const

describe('UI 013 consumed contract operations', () => {
  it('covers the 44 settings operations and seven shared operations', () => {
    expect(expected).toHaveLength(51)
  })
  it.each(expected)('%s retains its method, path and outcomes', (id, method, path, statuses) => {
    const operation = contract.paths[path]?.[method]
    expect(operation?.operationId).toBe(id)
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(statuses.split(',').sort())
  })
})
