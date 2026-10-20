import type { AuditEvent } from '@/api'
import { auditEvent } from './audit-event'

export function settingsAuditRecords(now: number): AuditEvent[] {
  const rows: [
    AuditEvent['eventType'],
    NonNullable<AuditEvent['target']>['type'],
    string | null,
    AuditEvent['details'],
  ][] = [
    [
      'logoReplacement',
      'logo',
      'light',
      { old: null, new: { mediaType: 'image/png', sizeBytes: 2048, width: 320, height: 80 } },
    ],
    [
      'logoDeletion',
      'logo',
      'dark',
      { old: { mediaType: 'image/svg+xml', sizeBytes: 1024, width: null, height: null } },
    ],
    [
      'uiTextsUpdate',
      'uiTexts',
      null,
      {
        changes: {
          productName: { old: 'Mail', new: 'Example Mail' },
          loginHelpHtml: { changed: true, oldBytes: 1024, newBytes: 2048 },
        },
        footerMigrated: false,
      },
    ],
    [
      'loginPageUpdate',
      'loginPage',
      null,
      { changes: { forceSingleSignOn: { old: false, new: true } } },
    ],
    [
      'appLinksUpdate',
      'appLinks',
      null,
      {
        changes: {
          links: {
            old: [],
            new: [
              {
                name: 'Support',
                url: 'https://example.org',
                signedInUrl: null,
                showOnLoginPage: true,
              },
            ],
          },
        },
      },
    ],
    [
      'brandColorsUpdate',
      'brandColors',
      null,
      { changes: { light: { old: null, new: '#1d4ed8' } } },
    ],
    ['ipCheckUpdate', 'ipCheck', null, { changes: { enabled: { old: false, new: true } } }],
    [
      'passwordPolicyUpdate',
      'passwordPolicy',
      null,
      { changes: { minLength: { old: 8, new: 12 } } },
    ],
    [
      'passwordResetNotificationUpdate',
      'passwordResetNotification',
      null,
      { changes: { htmlTemplate: { changed: true, oldBytes: 1024, newBytes: 2048 } } },
    ],
    [
      'quotaNotificationUpdate',
      'quotaNotification',
      null,
      { changes: { sender: { old: 'old@example.org', new: 'new@example.org' } } },
    ],
    [
      'quotaNotificationRecipientsUpdate',
      'quotaNotificationRecipients',
      'example.org',
      {
        changes: {
          recipients: { old: [], new: ['alerts@example.org'] },
          active: { old: false, new: true },
        },
      },
    ],
    [
      'rspamdSettingsRuleCreation',
      'rspamdSettingsRule',
      '1',
      {
        changes: {
          description: { old: null, new: 'First rule' },
          content: { changed: true, oldBytes: 0, newBytes: 200 },
        },
      },
    ],
    [
      'rspamdSettingsRuleUpdate',
      'rspamdSettingsRule',
      '1',
      { changes: { content: { changed: true, oldBytes: 200, newBytes: 400 } } },
    ],
    [
      'rspamdSettingsRuleDeletion',
      'rspamdSettingsRule',
      '2',
      { changes: { content: { changed: true, oldBytes: 100, newBytes: 0 } } },
    ],
    [
      'rspamdRegexMapReplacement',
      'rspamdRegexMap',
      'global_mime_from_blacklist.map',
      { oldBytes: 1024, newBytes: 2048 },
    ],
    [
      'globalSieveFilterReplacement',
      'globalSieveFilter',
      'prefilter',
      {
        oldBytes: 1024,
        newBytes: 2048,
        dovecotRestart: 'failed',
        restartDetail: '<unavailable>\u202Eservice',
      },
    ],
    [
      'rspamdUiPasswordChange',
      'rspamdUiPassword',
      null,
      { passwordChanged: true, rspamdConfirmed: true },
    ],
    [
      'legacyApiCorsUpdate',
      'legacyApiCors',
      null,
      { changes: { allowedOrigins: { old: [], new: ['https://example.org'] } } },
    ],
    [
      'massMailJobCreation',
      'massMailJob',
      '01JB3K4M5N6P7Q8R9S0TVWXYZA',
      {
        sender: 'admin@example.org',
        subject: 'Service announcement',
        selection: { domains: ['example.org'], domainCount: 1, includeCount: 0, excludeCount: 0 },
        recipientCount: 10,
      },
    ],
    [
      'massMailJobCompletion',
      'massMailJob',
      '01JB3K4M5N6P7Q8R9S0TVWXYZA',
      { counts: { pending: 0, delivered: 8, failed: 1, skipped: 1 } },
    ],
    [
      'massMailJobCancellation',
      'massMailJob',
      '01JB3K4M5N6P7Q8R9S0TVWXYZB',
      { counts: { pending: 0, delivered: 0, failed: 0, skipped: 10 } },
    ],
    ['licenseVerification', 'license', null, { result: 'unreachable' }],
  ]
  const events = rows.map(([eventType, type, id, details], index) =>
    auditEvent({
      eventType,
      target: { type, id, name: null },
      details,
      occurredAt: new Date(now - (index + 1) * 60_000).toISOString(),
    }),
  )
  for (const [index, [failureReason, status, problemType]] of (
    [
      ['demoMode', 403, 'demo-mode'],
      ['featureDisabled', 404, 'feature-disabled'],
      ['fileUnavailable', 409, 'regex-map-unavailable'],
      ['serviceFailure', 503, 'temporary-failure'],
      ['versionOutdated', 412, 'version-outdated'],
    ] as const
  ).entries())
    events.push(
      auditEvent({
        eventType: 'uiTextsUpdate',
        target: { type: 'uiTexts', id: null, name: null },
        outcome: 'failure',
        failureReason,
        details: { status, problemType: `/api/v2/problems/${problemType}` },
        occurredAt: new Date(now - (rows.length + index + 1) * 60_000).toISOString(),
      }),
    )
  return events
}
