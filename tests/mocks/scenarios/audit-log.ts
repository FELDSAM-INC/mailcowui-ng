// Scenarios of US8 (T135): audit records of every event type, outcome, failure reason and
// authentication method of the pinned contract. Values outside its closed enumerations are not
// seeded (research R22); unknown values are unit-tested instead (T137). Times are relative to the
// moment a scenario is created, so the 24 h, 7 d and 30 d presets always find the same records.
import type { AuditEvent } from '@/api'

import { auditEvent } from '../factories/audit-event'
import type { ScenarioDefinition } from './index'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The API key the key events act on. */
export const AUDIT_KEY_ID = '01JB3K4M5N6P7Q8R9S0TVWXYZA'
export const AUDIT_KEY_NAME = 'Billing system'
/** An API key that authenticated a request. */
export const AUDIT_ACTING_KEY_ID = '01JB3K4M5N6P7Q8R9S0TVWXYZB'
export const LONG_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) ${'AppleWebKit/537.36 '.repeat(25)}`
  .slice(0, 512)
  .padEnd(512, 'x')

const admin = { username: 'admin', role: 'admin' as const, apiKeyId: null }
const reseller = { username: 'reseller', role: 'domainAdmin' as const, apiKeyId: null }
const attempted = (username: string | null) => ({ username, role: null, apiKeyId: null })
const session = { type: 'session' as const, id: null, name: null }
const apiKeyTarget = { type: 'apiKey' as const, id: AUDIT_KEY_ID, name: AUDIT_KEY_NAME }

/** About 40 records, newest first, with times relative to `now`. */
export function auditRecords(now: number): AuditEvent[] {
  const at = (ago: number) => new Date(now - ago).toISOString()
  const records: AuditEvent[] = [
    auditEvent({
      occurredAt: at(5 * MINUTE),
      eventType: 'signIn',
      outcome: 'failure',
      actor: attempted('alice@example.org'),
      target: session,
      clientAddress: '192.0.2.10',
      authMethod: 'password',
      failureReason: 'invalidCredentials',
      details: { requestedRole: 'mailboxUser' },
    }),
    auditEvent({
      occurredAt: at(6 * MINUTE),
      eventType: 'signIn',
      outcome: 'failure',
      actor: attempted('alice@example.org'),
      target: session,
      clientAddress: '192.0.2.10',
      authMethod: 'passwordAndSecondFactor',
      failureReason: 'secondFactorFailed',
      details: { secondFactorType: 'totp' },
    }),
    auditEvent({
      occurredAt: at(7 * MINUTE),
      eventType: 'signIn',
      outcome: 'failure',
      actor: attempted('alice@example.org'),
      target: session,
      clientAddress: '192.0.2.10',
      authMethod: null,
      failureReason: 'throttled',
      details: {},
    }),
    auditEvent({
      occurredAt: at(10 * MINUTE),
      eventType: 'signIn',
      actor: admin,
      target: session,
      clientAddress: '198.51.100.4',
      authMethod: 'password',
    }),
    auditEvent({
      occurredAt: at(20 * MINUTE),
      eventType: 'apiKeyCreation',
      actor: admin,
      target: apiKeyTarget,
      clientAddress: '198.51.100.4',
      authMethod: 'password',
      details: { accessLevel: 'readOnly', ownerUsername: 'reseller' },
    }),
    auditEvent({
      occurredAt: at(30 * MINUTE),
      eventType: 'apiKeyRevocation',
      actor: admin,
      target: apiKeyTarget,
      clientAddress: '198.51.100.4',
      authMethod: 'password',
    }),
    auditEvent({
      occurredAt: at(40 * MINUTE),
      eventType: 'signOut',
      actor: admin,
      target: session,
      clientAddress: '198.51.100.4',
      authMethod: 'password',
    }),
    auditEvent({
      occurredAt: at(50 * MINUTE),
      eventType: 'preferencesUpdate',
      actor: admin,
      target: { type: 'preferences', id: null, name: null },
      clientAddress: '2001:db8::17',
      authMethod: 'password',
      details: { changedFields: ['language', 'theme'] },
    }),
    auditEvent({
      occurredAt: at(2 * HOUR),
      eventType: 'passkeyRegistration',
      actor: reseller,
      target: { type: 'passkey', id: 'b1c2d3', name: 'Laptop' },
      clientAddress: '203.0.113.20',
      authMethod: 'passkey',
    }),
    auditEvent({
      occurredAt: at(3 * HOUR),
      eventType: 'passkeyRename',
      actor: reseller,
      target: { type: 'passkey', id: 'b1c2d3', name: 'Work laptop' },
      clientAddress: '203.0.113.20',
      authMethod: 'passkey',
      details: { changedFields: ['name'] },
    }),
    auditEvent({
      occurredAt: at(4 * HOUR),
      eventType: 'passkeyRemoval',
      actor: reseller,
      target: { type: 'passkey', id: 'b1c2d3', name: 'Work laptop' },
      clientAddress: '203.0.113.20',
      authMethod: 'passkey',
    }),
    auditEvent({
      occurredAt: at(5 * HOUR),
      eventType: 'apiKeyCreation',
      actor: { username: 'admin', role: 'admin', apiKeyId: AUDIT_ACTING_KEY_ID },
      target: { type: 'apiKey', id: '01JB3K4M5N6P7Q8R9S0TVWXYZC', name: 'Provisioning' },
      clientAddress: '198.51.100.99',
      userAgent: 'billing-sync/2.1',
      authMethod: 'apiKey',
      details: { accessLevel: 'readWrite' },
    }),
    auditEvent({
      occurredAt: at(6 * HOUR),
      eventType: 'signIn',
      actor: admin,
      target: session,
      clientAddress: '198.51.100.4',
      userAgent: LONG_USER_AGENT,
      authMethod: 'passkey',
    }),
  ]
  const failures: [AuditEvent['failureReason'], AuditEvent['authMethod'], number][] = [
    ['unknownPasskey', 'passkey', 2 * DAY],
    ['passkeyInactive', 'passkey', 3 * DAY],
    ['roleMismatch', 'passkey', 4 * DAY],
    ['passkeyVerificationFailed', 'passkey', 5 * DAY],
    ['challengeExpired', 'passwordAndSecondFactor', 9 * DAY],
    ['accountInactive', 'password', 12 * DAY],
    ['externalIdentitySource', 'password', 15 * DAY],
    ['secondFactorUnavailable', 'password', 20 * DAY],
    ['verificationUnavailable', 'passwordAndSecondFactor', 25 * DAY],
  ]
  for (const [failureReason, authMethod, ago] of failures) {
    records.push(
      auditEvent({
        occurredAt: at(ago),
        eventType: 'signIn',
        outcome: 'failure',
        actor: attempted(authMethod === 'passkey' ? null : 'bob@example.org'),
        target: session,
        clientAddress: '203.0.113.7',
        authMethod,
        failureReason,
      }),
    )
  }
  records.push(
    auditEvent({
      occurredAt: at(26 * DAY),
      eventType: 'passkeyRegistration',
      outcome: 'failure',
      actor: reseller,
      target: { type: 'passkey', id: null, name: null },
      clientAddress: '203.0.113.20',
      authMethod: 'password',
      failureReason: 'registrationFailed',
    }),
  )
  // Older successful sign-ins, to fill more than one page.
  for (let index = 0; index < 18; index += 1) {
    records.push(
      auditEvent({
        occurredAt: at(27 * DAY + index * 2 * DAY),
        eventType: 'signIn',
        actor: index % 2 === 0 ? admin : reseller,
        target: session,
        clientAddress: `198.51.100.${10 + index}`,
        authMethod: index % 3 === 0 ? 'passkey' : 'password',
      }),
    )
  }
  return records
}

export const auditLogScenarios: Record<string, ScenarioDefinition> = {
  'audit-records': {
    description:
      'admin is signed in; about 40 audit records of every event type, outcome and reason, among them failed sign-ins of alice@example.org from 192.0.2.10.',
    // A getter, so that every scenario created from it gets times relative to its creation.
    get overrides() {
      return { signedInAs: 'admin', auditEvents: auditRecords(Date.now()) }
    },
  },
  'audit-empty': {
    description: 'admin is signed in; the audit log is empty.',
    overrides: { signedInAs: 'admin', auditEvents: [] },
  },
}
