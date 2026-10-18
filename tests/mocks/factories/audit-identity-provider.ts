// Audit records that API 012 writes (UI 012 T089, research R24), with the details keys that
// mailcow-rest-v2's `docs/audit-events.md` documents for them.
import type { AuditActor, AuditEvent } from '@/api'

import { auditEvent } from './audit-event'

const MINUTE = 60_000
const admin: AuditActor = { username: 'admin', role: 'admin', apiKeyId: null }
const anna: AuditActor = { username: 'anna@example.org', role: null, apiKeyId: null }
const providerTarget = (name: string) => ({ type: 'identityProvider' as const, id: null, name })

/** The OAuth2 client of the records (client page History). */
export const AUDIT_OAUTH2_CLIENT = { id: 4, clientId: 'a1b2c3000004' }
const clientTarget = { type: 'oauth2Client' as const, id: '4', name: AUDIT_OAUTH2_CLIENT.clientId }

/** The failure reasons of API 012 that a sign-in through the provider can carry. */
export const API_012_SIGN_IN_FAILURES = [
  'signInStateInvalid',
  'singleSignOnNotAvailable',
  'providerRefused',
  'identityProviderUnavailable',
  'noEmailAddress',
  'mailboxNotLinked',
  'autoCreationOff',
  'mailboxCreationFailed',
  'passwordNotVerifiable',
] as const

/** The records, newest first, with times relative to `now`. */
export function identityProviderAuditRecords(now: number): AuditEvent[] {
  let minutes = 0
  const at = () => new Date(now - (minutes += 5) * MINUTE).toISOString()
  return [
    auditEvent({
      occurredAt: at(),
      eventType: 'identityProviderUpdate',
      actor: admin,
      target: providerTarget('ldap'),
      details: {
        type: 'ldap',
        previousType: 'ldap',
        changes: { syncInterval: { old: 15, new: 60 }, bindPassword: { changed: true } },
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'identityProviderConnectionTest',
      outcome: 'failure',
      failureReason: 'connectionTestFailed',
      actor: admin,
      target: providerTarget('ldap'),
      details: {
        type: 'ldap',
        testedAddress: 'ldap://ldap1.example.org:389',
        outcome: 'failure',
        failureCategory: 'credentialsRejected',
        providerStatus: 49,
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'identityProviderDeletion',
      outcome: 'failure',
      failureReason: 'conflict',
      actor: admin,
      target: providerTarget('ldap'),
      details: {
        mailboxCounts: { keycloak: 0, genericOidc: 3, ldap: 340 },
        problemType: '/api/v2/problems/identity-provider-in-use',
        status: 409,
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'oauth2ClientCreation',
      actor: admin,
      target: clientTarget,
      details: { redirectUris: ['https://wiki.example.org/oauth/callback'] },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'oauth2ClientUpdate',
      actor: admin,
      target: clientTarget,
      details: {
        changes: {
          redirectUris: {
            old: ['https://wiki.example.org/oauth/callback'],
            new: ['https://wiki.example.org/oauth/callback', 'https://wiki.example.org/cb2'],
          },
        },
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'oauth2ClientSecretRegeneration',
      actor: admin,
      target: clientTarget,
      details: { bulkRequestId: 'b'.repeat(32) },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'oauth2ClientTokenRevocation',
      actor: admin,
      target: clientTarget,
      details: {
        removed: { accessTokens: 12, refreshTokens: 4, authorizationCodes: 1 },
        bulkRequestId: 'b'.repeat(32),
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'oauth2ClientDeletion',
      actor: admin,
      target: { type: 'oauth2Client', id: '9', name: 'a1b2c3000009' },
      details: { removed: { accessTokens: 0, refreshTokens: 0, authorizationCodes: 0 } },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'signIn',
      outcome: 'failure',
      failureReason: 'noMatchingMapping',
      authMethod: 'singleSignOn',
      actor: anna,
      details: { requestedRole: null, identityProvider: 'keycloak' },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'signIn',
      outcome: 'failure',
      failureReason: 'providerReturnedError',
      authMethod: 'singleSignOn',
      actor: { username: null, role: null, apiKeyId: null },
      details: {
        requestedRole: null,
        identityProvider: 'keycloak',
        providerError: 'access_denied',
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'signIn',
      authMethod: 'directoryPassword',
      actor: { username: 'carl@example.org', role: 'mailboxUser', apiKeyId: null },
      details: {
        requestedRole: 'mailboxUser',
        identityProvider: 'ldap',
        mailboxCreated: false,
        templateApplied: true,
      },
    }),
    auditEvent({
      occurredAt: at(),
      eventType: 'identityProviderSessionEnd',
      outcome: 'failure',
      failureReason: 'providerRefused',
      authMethod: 'singleSignOn',
      actor: { username: 'anna@example.org', role: 'mailboxUser', apiKeyId: null },
      details: { identityProvider: 'keycloak', reason: 'providerRefused' },
    }),
    ...API_012_SIGN_IN_FAILURES.map((reason) =>
      auditEvent({
        occurredAt: at(),
        eventType: 'signIn',
        outcome: 'failure',
        failureReason: reason,
        authMethod: reason === 'passwordNotVerifiable' ? 'providerPassword' : 'singleSignOn',
        actor: anna,
        details: { requestedRole: null, identityProvider: 'keycloak' },
      }),
    ),
  ]
}
