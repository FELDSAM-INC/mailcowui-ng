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
