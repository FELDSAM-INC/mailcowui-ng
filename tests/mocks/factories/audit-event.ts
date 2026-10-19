// Audit event factory: contract-valid `AuditEvent` objects. Only values of the pinned contract's
// closed enumerations may be used (research R22); unknown values are unit-tested instead.
import type { AuditEvent } from '@/api'

import { requestId, ulid } from './ids'

let counter = 0

export function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  counter += 1
  return {
    id: ulid(),
    occurredAt: new Date(Date.UTC(2026, 9, 18, 10, 0) - counter * 60_000).toISOString(),
    eventType: 'signIn',
    outcome: 'success',
    actor: { username: 'admin', role: 'admin', apiKeyId: null },
    target: { type: 'session', id: null, name: null },
    clientAddress: '192.0.2.10',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0',
    authMethod: 'password',
    failureReason: null,
    requestId: requestId(),
    details: {},
    ...overrides,
  }
}

/** The records API 002 writes for a domain, its footer and a template (UI 002 research D28). */
export type DomainAuditKind =
  | 'domainCreation'
  | 'domainUpdate'
  | 'domainDeletion'
  | 'domainFooterUpdate'
  | 'domainTemplateCreation'
  | 'domainTemplateUpdate'
  | 'domainTemplateDeletion'

const TARGET_TYPE: Record<DomainAuditKind, 'domain' | 'domainFooter' | 'domainTemplate'> = {
  domainCreation: 'domain',
  domainUpdate: 'domain',
  domainDeletion: 'domain',
  domainFooterUpdate: 'domainFooter',
  domainTemplateCreation: 'domainTemplate',
  domainTemplateUpdate: 'domainTemplate',
  domainTemplateDeletion: 'domainTemplate',
}

/**
 * A domain, footer or template record. `target` is the ASCII domain name (`name` its readable
 * form) or the template ID and name. A failure carries one of the failure reasons of API 002.
 */
export function domainAuditEvent(
  kind: DomainAuditKind,
  target: { id: string; name: string },
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return auditEvent({
    eventType: kind,
    target: { type: TARGET_TYPE[kind], id: target.id, name: target.name },
    ...overrides,
  })
}

/** A refused domain, footer or template change with one of API 002's failure reasons. */
export function refusedDomainAuditEvent(
  kind: DomainAuditKind,
  target: { id: string; name: string },
  failureReason:
    | 'attributeNotPermitted'
    | 'versionOutdated'
    | 'validationFailed'
    | 'conflict'
    | 'temporaryFailure',
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return domainAuditEvent(kind, target, { outcome: 'failure', failureReason, ...overrides })
}

/**
 * UI 011 (T136): records of the 17 event types of monitoring and operations, with the details API
 * 011 writes (`docs/audit-events.md` of the API; the contract leaves `details` open, so the app
 * shows them as stored). Includes a deletion of 4 queue IDs and one of 400.
 */
export function operationsAuditEvents(): AuditEvent[] {
  const container = (eventType: 'containerStart' | 'containerStop' | 'containerRestart') =>
    auditEvent({
      eventType,
      target: { type: 'container', id: 'sogo-mailcow', name: null },
      details: {
        action: eventType.replace('container', '').toLowerCase(),
        stateBefore: { state: 'running', startedAt: '2026-10-18T07:00:00Z' },
        stateAfter: { state: 'running', startedAt: '2026-10-18T10:00:00Z' },
      },
    })
  const queueResults = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: (0x4f2a00 + index).toString(16).toUpperCase(),
      outcome: index === 3 ? 'notFound' : 'done',
    }))
  const queue = (
    eventType: 'mailQueueDelivery' | 'mailQueueHold' | 'mailQueueRelease' | 'mailQueueDeletion',
    count: number,
  ) =>
    auditEvent({
      eventType,
      target: { type: 'mailQueue', id: null, name: null },
      details: { results: queueResults(count) },
    })
  return [
    container('containerRestart'),
    container('containerStop'),
    container('containerStart'),
    auditEvent({
      eventType: 'containerRestart',
      outcome: 'failure',
      failureReason: 'outcomeUnknown',
      target: { type: 'container', id: 'nginx-mailcow', name: null },
      details: { action: 'restart' },
    }),
    auditEvent({
      eventType: 'containerStop',
      outcome: 'failure',
      failureReason: 'serviceFailure',
      target: { type: 'container', id: 'clamd-mailcow', name: null },
      details: { action: 'stop', serviceMessage: 'container is restarting' },
    }),
    queue('mailQueueDeletion', 4),
    queue('mailQueueDeletion', 400),
    queue('mailQueueHold', 2),
    queue('mailQueueRelease', 2),
    queue('mailQueueDelivery', 1),
    auditEvent({ eventType: 'mailQueueFlush', target: { type: 'mailQueue', id: null, name: null } }),
    auditEvent({ eventType: 'mailQueuePurge', target: { type: 'mailQueue', id: null, name: null } }),
    auditEvent({
      eventType: 'mailQueueMessageView',
      target: { type: 'mailQueueMessage', id: '4F2A1B', name: null },
    }),
    auditEvent({
      eventType: 'fail2banSettingsUpdate',
      target: { type: 'fail2banSettings', id: null, name: null },
      details: {
        changes: { banTime: { old: 1800, new: 7200 } },
        allowlistAdded: ['192.0.2.0/24'],
        allowlistRemoved: ['198.51.100.0/24'],
      },
    }),
    auditEvent({
      eventType: 'fail2banRulesReplacement',
      target: { type: 'fail2banRules', id: null, name: null },
      details: { oldRules: ['^old (\\S+)$'], newRules: ['^new (\\S+)$'] },
    }),
    auditEvent({
      eventType: 'fail2banRulesReset',
      outcome: 'failure',
      failureReason: 'rulesNotRestored',
      target: { type: 'fail2banRules', id: null, name: null },
    }),
    auditEvent({
      eventType: 'fail2banBanLift',
      target: { type: 'fail2banActiveBan', id: '203.0.113.0/24', name: null },
      details: { network: '203.0.113.0/24' },
    }),
    auditEvent({
      eventType: 'fail2banBanAllowlisting',
      target: { type: 'fail2banActiveBan', id: '203.0.113.0/24', name: null },
      details: { network: '203.0.113.0/24', allowlistAdded: ['203.0.113.0/24'] },
    }),
    auditEvent({
      eventType: 'fail2banBanDenylisting',
      target: { type: 'fail2banActiveBan', id: '198.51.100.0/24', name: null },
      details: { network: '198.51.100.0/24', denylistAdded: ['198.51.100.0/24'] },
    }),
    auditEvent({
      eventType: 'fail2banBanListIdRotation',
      target: { type: 'fail2banBanListId', id: null, name: null },
    }),
  ]
}
