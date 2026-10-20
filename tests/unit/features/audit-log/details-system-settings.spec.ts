import { describe, expect, it } from 'vitest'
import { auditDetailRows, auditLabel, auditTargetLink } from '@/features/audit-log/labels'
import {
  settingsAuditEvents,
  settingsAuditTargets,
} from '@/features/audit-log/details/system-settings'
import { hasMessage, i18n, loadLocale, text } from '@/i18n'
import { formatBytes } from '@/i18n/format'
import AuditEventDetails from '@/features/audit-log/components/AuditEventDetails.vue'
import { mountWithApp } from '../../support/mount'
import { auditEvent } from '../../../mocks/factories/audit-event'
const tr = { t: text, te: hasMessage }

describe('settings audit details', () => {
  it('labels all 22 events and 17 targets, including feature 003 password policy', () => {
    expect(settingsAuditEvents).toHaveLength(22)
    expect(settingsAuditTargets).toHaveLength(17)
    for (const code of settingsAuditEvents)
      expect(auditLabel('eventType', code, tr)).not.toContain('Unknown (')
    for (const code of settingsAuditTargets)
      expect(auditLabel('targetType', code, tr)).not.toContain('Unknown (')
    for (const code of [
      'demoMode',
      'featureDisabled',
      'fileUnavailable',
      'serviceFailure',
      'outcomeUnknown',
    ])
      expect(auditLabel('failureReason', code, tr)).not.toContain('Unknown (')
    expect(auditLabel('eventType', 'futureSettingsOperation', tr)).toBe(
      'Unknown (futureSettingsOperation)',
    )
  })
  it('shows changed fields and binary sizes while hiding template, script and password contents', () => {
    const event = auditEvent({
      eventType: 'passwordResetNotificationUpdate',
      details: {
        changes: {
          sender: { old: 'old@example.org', new: 'new@example.org' },
          htmlTemplate: { changed: true, oldBytes: 1024, newBytes: 2048 },
          textTemplate: { old: 'private old template', new: 'private new template' },
        },
        password: 'never-show-this',
        future: { newField: 12 },
      },
    })
    expect(auditDetailRows(event)).toEqual([
      {
        key: 'changes',
        lines: [
          'From: old@example.org → new@example.org',
          'HTML template: changed (1 KiB → 2 KiB)',
          'Text template: changed',
        ],
      },
      { key: 'password', lines: ['changed'] },
      { key: 'future', lines: ['{"newField":12}'] },
    ])
  })
  it('formats logo metadata, script sizes and restart outcomes without opaque JSON', () => {
    const logo = auditEvent({
      eventType: 'logoReplacement',
      details: {
        old: null,
        new: { mediaType: 'image/png', sizeBytes: 2048, width: 320, height: 80 },
      },
    })
    expect(auditDetailRows(logo)[1]).toEqual({
      key: 'new',
      lines: ['image/png', '2 KiB', '320 × 80 px'],
    })
    const filter = auditEvent({
      eventType: 'globalSieveFilterReplacement',
      details: { oldBytes: 1024, newBytes: 2048, dovecotRestart: 'failed' },
    })
    expect(auditDetailRows(filter)).toEqual([
      { key: 'oldBytes', lines: ['1 KiB'] },
      { key: 'newBytes', lines: ['2 KiB'] },
      {
        key: 'dovecotRestart',
        lines: ['Restart failed; the script is saved and applies at the next restart'],
      },
    ])
  })
  it('describes a password change and job counts with translated labels', () => {
    const password = auditEvent({
      eventType: 'rspamdUiPasswordChange',
      details: { passwordChanged: true, rspamdConfirmed: true, password: 'hidden' },
    })
    expect(auditDetailRows(password, (value) => (value ? 'Yes' : 'No'))).toEqual([
      { key: 'passwordChanged', lines: ['changed'] },
      { key: 'rspamdConfirmed', lines: ['Yes'] },
      { key: 'password', lines: ['changed'] },
    ])
    const job = auditEvent({
      eventType: 'massMailJobCompletion',
      details: { counts: { pending: 0, delivered: 1000, failed: 2, skipped: 3 } },
    })
    expect(auditDetailRows(job)).toEqual([
      { key: 'counts', lines: ['Pending: 0', 'Delivered: 1,000', 'Failed: 2', 'Skipped: 3'] },
    ])
  })
  it('links singleton settings and individual objects, and omits deleted objects', () => {
    expect(
      auditTargetLink(
        auditEvent({
          eventType: 'quotaNotificationUpdate',
          target: { type: 'quotaNotification', id: null, name: null },
        }),
      ),
    ).toEqual({ name: 'system-settings-quota-notifications', params: {} })
    expect(
      auditTargetLink(
        auditEvent({
          eventType: 'rspamdRegexMapReplacement',
          target: { type: 'rspamdRegexMap', id: 'global_mime_from_blacklist.map', name: null },
        }),
      ),
    ).toEqual({
      name: 'system-settings-filter-map',
      params: { mapId: 'global_mime_from_blacklist.map' },
    })
    expect(
      auditTargetLink(
        auditEvent({
          eventType: 'rspamdSettingsRuleDeletion',
          target: { type: 'rspamdSettingsRule', id: '1', name: null },
        }),
      ),
    ).toBeNull()
  })
  it('renders untrusted detail text literally and makes bidi controls visible', () => {
    const event = auditEvent({
      eventType: 'globalSieveFilterReplacement',
      details: { restartDetail: '<img src=x onerror=alert(1)>\u202Eservice failed' },
    })
    const wrapper = mountWithApp(AuditEventDetails, { props: { event, variant: 'list' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.text()).toContain('U+202E')
  })
  it.each(['cs-cz', 'sk-sk'] as const)(
    'formats sizes and flags in %s while new copy remains an explicit source fallback',
    async (locale) => {
      await loadLocale(i18n, locale)
      i18n.global.locale.value = locale
      const event = auditEvent({
        eventType: 'loginPageUpdate',
        details: { changes: { forceSingleSignOn: { old: false, new: true } }, oldBytes: 2048 },
      })
      const rows = auditDetailRows(event, (value) =>
        text(value ? 'domains.values.yes' : 'domains.values.no'),
      )
      expect(rows[0]!.lines[0]).toContain(
        `${text('domains.values.no')} → ${text('domains.values.yes')}`,
      )
      expect(rows[1]!.lines).toEqual([formatBytes(2048, locale)])
      expect(auditLabel('eventType', 'loginPageUpdate', tr)).toBe('Login page changed')
    },
  )
})
