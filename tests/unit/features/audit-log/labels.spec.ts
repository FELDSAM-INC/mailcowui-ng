// T137: labels of audit codes (US8-AS3, FR-074) with plain values, not mocked responses (R24):
// known codes are translated, codes this version does not know show a generic label with the code.
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import { i18n, loadLocale } from '@/i18n'
import AuditEventItem from '@/features/audit-log/components/AuditEventItem.vue'
import {
  auditDetailRows,
  auditLabel,
  auditLabelKey,
  detailLabel,
} from '@/features/audit-log/labels'
import { hasMessage, text } from '@/i18n'
import { LEGACY_TEXTS } from '@/i18n/legacy-messages'
import csCz from '@/i18n/messages/cs-cz.json'
import skSk from '@/i18n/messages/sk-sk.json'

import { mountWithApp } from '../../support/mount'
import { auditEvent } from '../../../mocks/factories/audit-event'

const tr = { t: text, te: hasMessage }

const selfServiceTargets = [
  'accountPassword',
  'secondFactor',
  'recoveryEmail',
  'passwordReset',
  'appPassword',
  'temporaryAlias',
  'sieveFilter',
  'pushNotificationSettings',
  'mailSettings',
  'recentLogins',
  'groupwareData',
  'webmailHandOff',
]
const selfServiceEvents = [
  'ownPasswordChange',
  'ownSecondFactorEnrolment',
  'ownSecondFactorRemoval',
  'ownRecoveryEmailChange',
  'passwordResetRequest',
  'passwordResetCompletion',
  'appPasswordCreation',
  'appPasswordUpdate',
  'appPasswordDeletion',
  'temporaryAliasCreation',
  'temporaryAliasUpdate',
  'temporaryAliasDeletion',
  'sieveFilterCreation',
  'sieveFilterUpdate',
  'sieveFilterDeletion',
  'pushNotificationSettingsUpdate',
  'pushNotificationSettingsDeletion',
  'pushNotificationVerification',
  'mailSettingsUpdate',
  'recentLoginsClear',
  'activeSyncCacheReset',
  'groupwareProfileReset',
  'webmailHandOff',
]

describe('UI 005 self-service audit', () => {
  it('labels every self-service event, target and documented refusal', () => {
    for (const code of selfServiceEvents)
      expect(auditLabel('eventType', code, tr)).not.toContain('Unknown (')
    for (const code of selfServiceTargets)
      expect(auditLabel('targetType', code, tr)).not.toContain('Unknown (')
    for (const code of [
      'currentPasswordIncorrect',
      'externalIdentitySource',
      'featureDisabled',
      'challengeExpired',
      'registrationFailed',
      'lastSecondFactor',
      'secondFactorRequiredByPolicy',
      'notConfigured',
      'verificationUnavailable',
      'unknownAccount',
      'accountNotEligible',
      'noRecoveryEmail',
      'tokenLimitReached',
      'messageNotSent',
    ])
      expect(auditLabel('failureReason', code, tr)).not.toContain('Unknown (')
  })

  it('formats redacted secrets and script size changes as text, without changing arbitrary text values', () => {
    const event = auditEvent({
      eventType: 'pushNotificationSettingsUpdate',
      details: {
        password: 'changed',
        changes: {
          token: 'set',
          userKey: 'changed',
          password: 'generated',
          script: { changed: true, oldSize: 120, newSize: 240 },
          description: { old: 'set', new: 'changed' },
        },
      },
    })
    expect(auditDetailRows(event)).toEqual([
      { key: 'password', lines: ['changed'] },
      {
        key: 'changes',
        lines: [
          'token: set',
          'userKey: changed',
          'password: generated',
          'script: changed (120 → 240 bytes)',
          'description: set → changed',
        ],
      },
    ])
  })

  it('localises redaction sentinels while preserving user-entered names', async () => {
    await loadLocale(i18n, 'cs-cz')
    i18n.global.locale.value = 'cs-cz'
    const event = auditEvent({
      eventType: 'pushNotificationSettingsUpdate',
      details: {
        password: 'changed',
        changes: {
          token: 'set',
          script: { changed: true, oldSize: 1200, newSize: 2400 },
          name: { old: 'set', new: 'changed' },
        },
      },
    })
    expect(auditDetailRows(event)).toEqual([
      { key: 'password', lines: ['změněno'] },
      {
        key: 'changes',
        lines: [
          'token: nastaveno',
          'script: změněno (1\u00a0200 → 2\u00a0400 bajtů)',
          'name: set → changed',
        ],
      },
    ])
  })
})

describe('auditLabel', () => {
  it('translates known codes of every kind', () => {
    expect(auditLabel('eventType', 'apiKeyRevocation', tr)).toBe('API key revoked')
    expect(auditLabel('failureReason', 'invalidCredentials', tr)).toBe('Wrong username or password')
    expect(auditLabel('authMethod', 'passkey', tr)).toBe('Passkey')
    expect(auditLabel('outcome', 'failure', tr)).toBe('Failure')
    // Codes with a classic name show mailcow's text (LEGACY_TEXTS).
    expect(auditLabel('outcome', 'success', tr)).toBe('Success')
    expect(auditLabel('targetType', 'apiKey', tr)).toBe('API key')
    expect(auditLabel('authMethod', 'password', tr)).toBe('Password')
  })

  it('UI 002 T098 translates the domain events, targets and failure reasons', () => {
    expect(auditLabel('eventType', 'domainCreation', tr)).toBe('Domain added')
    expect(auditLabel('eventType', 'domainUpdate', tr)).toBe('Domain changed')
    expect(auditLabel('eventType', 'domainDeletion', tr)).toBe('Domain removed')
    expect(auditLabel('eventType', 'domainFooterUpdate', tr)).toBe('Domain footer changed')
    expect(auditLabel('eventType', 'domainTemplateCreation', tr)).toBe('Domain template added')
    expect(auditLabel('eventType', 'domainTemplateUpdate', tr)).toBe('Domain template changed')
    expect(auditLabel('eventType', 'domainTemplateDeletion', tr)).toBe('Domain template removed')
    // The domain and its footer by their classic names (LEGACY_TEXTS).
    expect(auditLabel('targetType', 'domain', tr)).toBe('Domain')
    expect(auditLabel('targetType', 'domainFooter', tr)).toBe('Domain wide footer')
    expect(auditLabel('targetType', 'domainTemplate', tr)).toBe('Domain template')
    for (const [reason, label] of [
      ['attributeNotPermitted', 'Change not permitted'],
      ['versionOutdated', 'Changed in the meantime'],
      ['validationFailed', 'Invalid values'],
      ['conflict', 'Conflict with existing data'],
      ['temporaryFailure', 'Temporary failure'],
    ]) {
      expect(auditLabel('failureReason', reason!, tr)).toBe(label)
    }
  })

  it('UI 010 T102 translates the DKIM and MTA-STS events and targets', () => {
    for (const [type, label] of [
      ['dkimKeyGeneration', 'DKIM key generated'],
      ['dkimKeyImport', 'DKIM key imported'],
      ['dkimKeyCopy', 'DKIM key copied'],
      ['dkimKeyDeletion', 'DKIM key removed'],
      ['dkimPrivateKeyExport', 'DKIM private key exported'],
      ['dkimDnsPublication', 'DKIM record published'],
      ['mtaStsPolicyCreation', 'MTA-STS policy added'],
      ['mtaStsPolicyUpdate', 'MTA-STS policy changed'],
    ]) {
      expect(auditLabel('eventType', type!, tr)).toBe(label)
    }
    expect(auditLabel('targetType', 'dkimKey', tr)).toBe('DKIM key')
    // The MTA-STS policy target uses the classic tab's name (LEGACY_TEXTS).
    expect(auditLabel('targetType', 'mtaStsPolicy', tr)).toBe('MTA-STS')
  })

  it('UI 009 T110 labels the routing events and targets in all three locales', () => {
    const events: [string, string][] = [
      ['relayhostCreation', 'Sender-dependent transport added'],
      ['relayhostUpdate', 'Sender-dependent transport changed'],
      ['relayhostDeletion', 'Sender-dependent transport removed'],
      ['relayhostTest', 'Sender-dependent transport tested'],
      ['relayhostAssignmentUpdate', 'Sender-dependent transport assignment changed'],
      ['transportCreation', 'Transport added'],
      ['transportUpdate', 'Transport changed'],
      ['transportDeletion', 'Transport removed'],
      ['transportTest', 'Transport tested'],
      ['bccMapCreation', 'BCC map added'],
      ['bccMapUpdate', 'BCC map changed'],
      ['bccMapDeletion', 'BCC map removed'],
      ['recipientMapCreation', 'Recipient map added'],
      ['recipientMapUpdate', 'Recipient map changed'],
      ['recipientMapDeletion', 'Recipient map removed'],
      ['tlsPolicyMapCreation', 'TLS policy map added'],
      ['tlsPolicyMapUpdate', 'TLS policy map changed'],
      ['tlsPolicyMapDeletion', 'TLS policy map removed'],
      ['forwardingHostCreation', 'Forwarding host added'],
      ['forwardingHostUpdate', 'Forwarding host changed'],
      ['forwardingHostDeletion', 'Forwarding host removed'],
    ]
    const targets: [string, string][] = [
      ['relayhost', 'Sender-dependent transport'],
      ['domainRelayhostAssignment', 'Sender-dependent transport of a domain'],
      ['mailboxRelayhostAssignment', 'Sender-dependent transport of a mailbox'],
      ['transport', 'Transport'],
      // By their classic names (LEGACY_TEXTS).
      ['bccMap', 'BCC map'],
      ['recipientMap', 'Recipient map'],
      ['tlsPolicyMap', 'TLS policy map'],
      ['forwardingHost', 'Forwarding host'],
    ]
    for (const [code, label] of events) expect(auditLabel('eventType', code, tr)).toBe(label)
    for (const [code, label] of targets) expect(auditLabel('targetType', code, tr)).toBe(label)
    for (const messages of [csCz, skSk]) {
      const enums = messages.enums as Record<string, Record<string, string>>
      for (const [code] of events) expect(enums.auditEventType![code]).toBeTruthy()
      for (const [code] of targets) {
        const key = `enums.auditTargetType.${code}`
        expect(enums.auditTargetType![code] ?? (key in LEGACY_TEXTS ? key : undefined)).toBeTruthy()
      }
    }
  })

  it('shows codes of later features with a generic label and the code', () => {
    expect(auditLabel('eventType', 'massMailJobCreation', tr)).toBe('Unknown (massMailJobCreation)')
    expect(auditLabel('failureReason', 'quotaExceeded', tr)).toBe('Unknown (quotaExceeded)')
    expect(auditLabel('authMethod', 'oauth2', tr)).toBe('Unknown (oauth2)')
  })

  it('keys every kind in one place', () => {
    expect(auditLabelKey('eventType', 'signIn')).toBe('enums.auditEventType.signIn')
    expect(auditLabelKey('failureReason', 'throttled')).toBe('enums.auditFailureReason.throttled')
  })
})

describe('detailLabel (UI 003 T120)', () => {
  it('labels the mailbox detail members and keeps any other member’s name', () => {
    expect(
      [
        'changes',
        'passwordSet',
        'preHashed',
        'previousAddress',
        'newAddress',
        'bulkRequestId',
        'steps',
        'keepOldAddressAsAlias',
      ].map((key) => detailLabel(key, tr)),
    ).toEqual([
      'Changes',
      'Password set',
      'Pre-hashed password',
      'Previous address',
      'New address',
      'Bulk request',
      'Steps',
      // The rename's choice, with the classic text of its checkbox.
      'Create alias automatically',
    ])
    expect(detailLabel('problemType', tr)).toBe('problemType')
  })

  it('shows the labels and Yes or No for flags in the record details', () => {
    const event = {
      id: '01JB3K4M5N6P7Q8R9S0TVWXYZB',
      occurredAt: '2026-10-18T10:00:00Z',
      eventType: 'mailboxUpdate',
      outcome: 'success',
      actor: { username: 'admin', role: 'admin', apiKeyId: null },
      target: { type: 'mailbox', id: 'anna@a.example', name: 'anna@a.example' },
      clientAddress: '192.0.2.1',
      userAgent: null,
      authMethod: null,
      failureReason: null,
      requestId: '0123456789abcdef0123456789abcdef',
      details: { passwordSet: true, preHashed: false },
    } as unknown as AuditEvent
    const wrapper = mountWithApp(AuditEventItem, { props: { event } })
    expect(wrapper.text()).toContain('Mailbox changed')
    const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
    expect(auditDetailRows(event, yesNo).map((row) => [row.key, row.lines])).toEqual([
      ['passwordSet', ['Yes']],
      ['preHashed', ['No']],
    ])
    // Flags inside a change read the same way; without a formatter they stay as stored.
    const change = { ...event, details: { changes: { active: { old: true, new: false } } } }
    expect(auditDetailRows(change, yesNo)[0]?.lines).toEqual(['active: Yes → No'])
    expect(auditDetailRows(change)[0]?.lines).toEqual(['active: true → false'])
  })
})

describe('AuditEventItem with unknown codes', () => {
  it('renders the record with generic labels instead of hiding it', () => {
    const event = {
      id: '01JB3K4M5N6P7Q8R9S0TVWXYZA',
      occurredAt: '2026-10-18T10:00:00Z',
      eventType: 'massMailJobCreation',
      outcome: 'failure',
      actor: { username: 'admin', role: 'admin', apiKeyId: null },
      target: null,
      clientAddress: '192.0.2.1',
      userAgent: null,
      authMethod: 'oauth2',
      failureReason: 'quotaExceeded',
      requestId: '0123456789abcdef0123456789abcdef',
      details: {},
    } as unknown as AuditEvent
    const wrapper = mountWithApp(AuditEventItem, { props: { event } })
    expect(wrapper.text()).toContain('Unknown (massMailJobCreation)')
    expect(wrapper.text()).toContain('Unknown (oauth2)')
    expect(wrapper.text()).toContain('Unknown (quotaExceeded)')
  })
})
