import type { AuditEvent } from '@/api'
import { hasMessage, i18n, text } from '@/i18n'
import { formatBytes, formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import type { AuditDetailRow, AuditLink, FlagText } from '../labels'

export const settingsAuditEvents = [
  'logoReplacement',
  'logoDeletion',
  'uiTextsUpdate',
  'loginPageUpdate',
  'appLinksUpdate',
  'brandColorsUpdate',
  'ipCheckUpdate',
  'passwordPolicyUpdate',
  'passwordResetNotificationUpdate',
  'quotaNotificationUpdate',
  'quotaNotificationRecipientsUpdate',
  'rspamdSettingsRuleCreation',
  'rspamdSettingsRuleUpdate',
  'rspamdSettingsRuleDeletion',
  'rspamdRegexMapReplacement',
  'globalSieveFilterReplacement',
  'rspamdUiPasswordChange',
  'legacyApiCorsUpdate',
  'massMailJobCreation',
  'massMailJobCompletion',
  'massMailJobCancellation',
  'licenseVerification',
] as const satisfies readonly AuditEvent['eventType'][]
export const settingsAuditTargets = [
  'logo',
  'uiTexts',
  'loginPage',
  'appLinks',
  'brandColors',
  'ipCheck',
  'passwordPolicy',
  'passwordResetNotification',
  'quotaNotification',
  'quotaNotificationRecipients',
  'rspamdSettingsRule',
  'rspamdRegexMap',
  'globalSieveFilter',
  'rspamdUiPassword',
  'legacyApiCors',
  'massMailJob',
  'license',
] as const satisfies readonly NonNullable<AuditEvent['target']>['type'][]
const events = new Set<string>(settingsAuditEvents)
const largeText = new Set([
  'loginHelpHtml',
  'footerHtml',
  'announcement.text',
  'textTemplate',
  'htmlTemplate',
  'content',
  'script',
  'textBody',
  'htmlBody',
])
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const locale = () => i18n.global.locale.value as AppLocale
const bytes = (value: number) => formatBytes(value, locale())
const field = (key: string) => {
  const label = `auditLog.settings.fields.${key.replaceAll('.', '_')}`
  return hasMessage(label) ? text(label) : key
}
function valueText(value: unknown, flag: FlagText): string {
  if (value === null) return text('auditLog.details.none')
  if (typeof value === 'boolean') return flag(value)
  if (typeof value === 'number') return formatNumber(value, locale())
  if (Array.isArray(value)) return value.map((item) => valueText(item, flag)).join(', ')
  if (record(value)) return JSON.stringify(value)
  return typeof value === 'string' ? value : ''
}
function changeText(path: string, value: unknown, flag: FlagText): string {
  if (record(value) && typeof value.oldBytes === 'number' && typeof value.newBytes === 'number')
    return text('auditLog.settings.changedSize', {
      old: bytes(value.oldBytes),
      new: bytes(value.newBytes),
    })
  // Scripts/templates remain size-only even if an older or newer server returns full content.
  if (largeText.has(path) || path === 'password') return text('auditLog.detailValues.changed')
  if (record(value) && 'old' in value && 'new' in value)
    return `${valueText(value.old, flag)} → ${valueText(value.new, flag)}`
  if (record(value) && value.changed === true) return text('auditLog.detailValues.changed')
  return valueText(value, flag)
}

/** Known settings shapes are readable; unknown members retain the existing generic renderer. */
export function settingsDetailRow(
  event: AuditEvent,
  key: string,
  value: unknown,
  flag: FlagText,
): AuditDetailRow | undefined {
  if (!events.has(event.eventType)) return
  if (key === 'changes' && record(value))
    return {
      key,
      lines: Object.entries(value).map(
        ([path, change]) => `${field(path)}: ${changeText(path, change, flag)}`,
      ),
    }
  if (largeText.has(key) || key === 'password')
    return { key, lines: [text('auditLog.detailValues.changed')] }
  if ((key === 'oldBytes' || key === 'newBytes') && typeof value === 'number')
    return { key, lines: [bytes(value)] }
  if (
    (event.eventType === 'logoReplacement' || event.eventType === 'logoDeletion') &&
    (key === 'old' || key === 'new')
  ) {
    if (value === null) return { key, lines: [text('auditLog.details.none')] }
    if (record(value)) {
      const lines: string[] = []
      if (typeof value.mediaType === 'string') lines.push(value.mediaType)
      if (typeof value.sizeBytes === 'number') lines.push(bytes(value.sizeBytes))
      if (typeof value.width === 'number' && typeof value.height === 'number')
        lines.push(
          text('auditLog.settings.dimensions', {
            width: formatNumber(value.width, locale()),
            height: formatNumber(value.height, locale()),
          }),
        )
      return { key, lines }
    }
  }
  if (
    key === 'dovecotRestart' &&
    typeof value === 'string' &&
    ['done', 'failed', 'deferred'].includes(value)
  )
    return { key, lines: [text(`auditLog.settings.restart.${value}`)] }
  if (key === 'passwordChanged' && value === true)
    return { key, lines: [text('auditLog.detailValues.changed')] }
  if (
    (key === 'counts' || key === 'selection') &&
    record(value) &&
    event.eventType.startsWith('massMailJob')
  )
    return {
      key,
      lines: Object.entries(value).map(
        ([name, count]) => `${field(name)}: ${valueText(count, flag)}`,
      ),
    }
  if (
    key === 'result' &&
    event.eventType === 'licenseVerification' &&
    typeof value === 'string' &&
    ['valid', 'invalid', 'unreachable'].includes(value)
  )
    return { key, lines: [text(`auditLog.settings.license.${value}`)] }
  if (key === 'recipientCount' && typeof value === 'number')
    return { key, lines: [formatNumber(value, locale())] }
}

const singletonRoutes: Record<string, string> = {
  logo: 'system-settings-logos',
  uiTexts: 'system-settings-ui-texts',
  brandColors: 'system-settings-colours',
  passwordPolicy: 'system-settings-password-policy',
  passwordResetNotification: 'system-settings-password-policy',
  quotaNotification: 'system-settings-quota-notifications',
  rspamdUiPassword: 'system-settings-rspamd-web-interface',
  globalSieveFilter: 'system-settings-global-sieve',
  ipCheck: 'system-settings-ip-check',
  legacyApiCors: 'system-settings-cors',
  license: 'system-settings-license',
}
export function settingsTargetLink(event: AuditEvent): AuditLink | undefined {
  const target = event.target
  if (!target || !events.has(event.eventType) || event.eventType.endsWith('Deletion')) return
  const name = singletonRoutes[target.type]
  if (name) return { name, params: {} }
  if (!target.id) return
  if (target.type === 'rspamdSettingsRule')
    return { name: 'rspamd-rule-detail', params: { ruleId: target.id } }
  if (target.type === 'rspamdRegexMap')
    return { name: 'system-settings-filter-map', params: { mapId: target.id } }
  if (target.type === 'massMailJob')
    return { name: 'system-settings-mass-mail-job', params: { jobId: target.id } }
  if (target.type === 'quotaNotificationRecipients')
    return { name: 'domain-detail', params: { domain: target.id } }
}
