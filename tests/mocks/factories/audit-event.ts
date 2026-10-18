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
