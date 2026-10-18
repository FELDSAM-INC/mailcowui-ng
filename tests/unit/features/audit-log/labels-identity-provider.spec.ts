// UI 012 T091: labels of the audit codes that API 012 adds (FR-067), with plain values, not mocked
// responses: every event type, target type, sign-in method and failure reason of API 012 has a
// label; those with a classic name show mailcow's text; details stay UI 001's generic view.
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import AuditEventDetails from '@/features/audit-log/components/AuditEventDetails.vue'
import { auditLabel } from '@/features/audit-log/labels'
import { hasMessage, lt, text } from '@/i18n'

import { mountWithApp } from '../../support/mount'

const tr = { t: text, te: hasMessage }

const EVENT_TYPES = [
  'identityProviderCreation',
  'identityProviderUpdate',
  'identityProviderDeletion',
  'identityProviderConnectionTest',
  'identityProviderSessionEnd',
  'oauth2ClientCreation',
  'oauth2ClientUpdate',
  'oauth2ClientSecretRegeneration',
  'oauth2ClientTokenRevocation',
  'oauth2ClientDeletion',
]
const FAILURE_REASONS = [
  'signInStateInvalid',
  'singleSignOnNotAvailable',
  'providerRefused',
  'providerReturnedError',
  'identityProviderUnavailable',
  'noEmailAddress',
  'mailboxNotLinked',
  'autoCreationOff',
  'noMatchingMapping',
  'mailboxCreationFailed',
  'passwordNotVerifiable',
  'connectionTestFailed',
]
const AUTH_METHODS = [
  'singleSignOn',
  'directoryPassword',
  'directoryPasswordAndSecondFactor',
  'providerPassword',
  'providerPasswordAndSecondFactor',
]

describe('API 012 audit labels', () => {
  it.each(EVENT_TYPES)('labels the event type %s', (code) => {
    expect(auditLabel('eventType', code, tr)).not.toMatch(/^Unknown/)
  })

  it.each(FAILURE_REASONS)('labels the failure reason %s', (code) => {
    expect(auditLabel('failureReason', code, tr)).not.toMatch(/^Unknown/)
  })

  it.each(AUTH_METHODS)('labels the sign-in method %s', (code) => {
    expect(auditLabel('authMethod', code, tr)).not.toMatch(/^Unknown/)
  })

  it('uses the classic names where legacy has them', () => {
    expect(auditLabel('targetType', 'identityProvider', tr)).toBe(lt('admin.iam'))
    expect(auditLabel('authMethod', 'singleSignOn', tr)).toBe(lt('admin.iam_sso'))
    expect(auditLabel('failureReason', 'connectionTestFailed', tr)).toBe(
      lt('danger.iam_test_connection'),
    )
    expect(auditLabel('targetType', 'oauth2Client', tr)).toBe('OAuth2 client')
    expect(auditLabel('eventType', 'oauth2ClientTokenRevocation', tr)).toBe(
      'OAuth2 client tokens revoked',
    )
  })

  it('shows unknown values of a later version with the generic label', () => {
    expect(auditLabel('eventType', 'identityProviderRename', tr)).toBe(
      'Unknown (identityProviderRename)',
    )
  })

  it('renders the documented details keys as text in the generic view', () => {
    const event = {
      id: '01J9AK00000000000000000001',
      occurredAt: '2026-10-19T08:00:00Z',
      eventType: 'identityProviderUpdate',
      outcome: 'success',
      actor: { username: 'admin', role: 'admin', apiKeyId: null },
      authMethod: 'password',
      clientAddress: '192.0.2.1',
      userAgent: null,
      requestId: 'a'.repeat(32),
      target: { type: 'identityProvider', id: null, name: 'ldap' },
      failureReason: null,
      details: {
        type: 'ldap',
        changes: { syncInterval: { old: 15, new: 60 }, bindPassword: { changed: true } },
      },
    } as unknown as AuditEvent
    const wrapper = mountWithApp(AuditEventDetails, { props: { event, variant: 'list' } })
    expect(wrapper.text()).toContain(`${lt('admin.iam')}: ldap`)
    expect(wrapper.text()).toContain('"syncInterval":{"old":15,"new":60}')
    expect(wrapper.text()).toContain('"bindPassword":{"changed":true}')
  })
})
