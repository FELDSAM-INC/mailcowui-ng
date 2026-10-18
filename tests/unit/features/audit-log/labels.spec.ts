// T137: labels of audit codes (US8-AS3, FR-074) with plain values, not mocked responses (R24):
// known codes are translated, codes this version does not know show a generic label with the code.
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import AuditEventItem from '@/features/audit-log/components/AuditEventItem.vue'
import { auditLabel, auditLabelKey } from '@/features/audit-log/labels'
import { hasMessage, text } from '@/i18n'

import { mountWithApp } from '../../support/mount'

const tr = { t: text, te: hasMessage }

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
