// T137: labels of audit codes (US8-AS3, FR-074) with plain values, not mocked responses (R24):
// known codes are translated, codes this version does not know show a generic label with the code.
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import AuditEventItem from '@/features/audit-log/components/AuditEventItem.vue'
import { auditLabel, auditLabelKey } from '@/features/audit-log/labels'
import { i18n } from '@/i18n'

import { mountWithApp } from '../../support/mount'

const tr = {
  t: (key: string, named?: Record<string, unknown>) =>
    named ? i18n.global.t(key, named) : i18n.global.t(key),
  te: (key: string) => i18n.global.te(key),
}

describe('auditLabel', () => {
  it('translates known codes of every kind', () => {
    expect(auditLabel('eventType', 'apiKeyRevocation', tr)).toBe('API key revoked')
    expect(auditLabel('failureReason', 'invalidCredentials', tr)).toBe('Wrong username or password')
    expect(auditLabel('authMethod', 'passkey', tr)).toBe('Passkey')
    expect(auditLabel('outcome', 'failure', tr)).toBe('Failure')
    expect(auditLabel('targetType', 'apiKey', tr)).toBe('API key')
  })

  it('shows codes of later features with a generic label and the code', () => {
    expect(auditLabel('eventType', 'domainCreation', tr)).toBe('Unknown (domainCreation)')
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
      eventType: 'domainCreation',
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
    expect(wrapper.text()).toContain('Unknown (domainCreation)')
    expect(wrapper.text()).toContain('Unknown (oauth2)')
    expect(wrapper.text()).toContain('Unknown (quotaExceeded)')
  })
})
