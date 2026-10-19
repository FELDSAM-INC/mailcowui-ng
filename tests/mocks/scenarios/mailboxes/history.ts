// UI 003 US9 scenario (T118): the audit records API 003 writes for anna@a.example (a quota change,
// a password set, a refused change, a bulk change), its rename from anna.old@a.example, and a
// template change, next to the mailboxes of the mailbox page. Times are relative to the moment the
// scenario is created, so the audit log's default range always finds them.
import type { AuditEvent } from '@/api'

import { auditEvent } from '../../factories/audit-event'
import { GIB } from '../../factories/domain'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { setupMailboxPage } from './edit'

const MINUTE = 60_000
const admin = { username: 'admin', role: 'admin' as const, apiKeyId: null }
const reseller = { username: 'reseller', role: 'domainAdmin' as const, apiKeyId: null }
const anna = { type: 'mailbox' as const, id: 'anna@a.example', name: 'anna@a.example' }

export function mailboxHistoryRecords(now: number): AuditEvent[] {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString()
  return [
    auditEvent({
      eventType: 'mailboxUpdate',
      target: anna,
      occurredAt: at(5),
      actor: admin,
      details: {
        bulkRequestId: '7f3a0c2e9b1d4e5f8a6b7c8d9e0f1a2b',
        changes: { status: { old: 'active', new: 'inactive' } },
      },
    }),
    auditEvent({
      eventType: 'mailboxUpdate',
      target: anna,
      occurredAt: at(10),
      actor: reseller,
      outcome: 'failure',
      failureReason: 'attributeNotPermitted',
      details: { problemType: '/api/v2/problems/attribute-not-permitted', status: 403 },
    }),
    auditEvent({
      eventType: 'mailboxUpdate',
      target: anna,
      occurredAt: at(20),
      actor: admin,
      details: { passwordSet: true, preHashed: false },
    }),
    auditEvent({
      eventType: 'mailboxUpdate',
      target: anna,
      occurredAt: at(30),
      actor: admin,
      details: { changes: { quota: { old: GIB, new: 2 * GIB } } },
    }),
    auditEvent({
      eventType: 'mailboxRename',
      target: anna,
      occurredAt: at(40),
      actor: admin,
      details: { previousAddress: 'anna.old@a.example', newAddress: 'anna@a.example' },
    }),
    auditEvent({
      eventType: 'mailboxTemplateUpdate',
      target: { type: 'mailboxTemplate', id: '1', name: 'Default' },
      occurredAt: at(50),
      actor: admin,
      details: { changes: { quota: { old: 0, new: GIB } } },
    }),
  ]
}

function setupHistory(state: ScenarioState): void {
  setupMailboxPage(state)
  state.auditEvents = mailboxHistoryRecords(Date.now())
}

export const mailboxHistoryScenarios: Record<string, ScenarioDefinition> = {
  'admin-history': {
    description:
      'An administrator with audit records of anna@a.example (quota, password, refused, bulk, rename) and of the Default template (UI 003 US9).',
    overrides: { signedInAs: 'admin' },
    setup: setupHistory,
  },
  'domain-admin-history': {
    description:
      'The same records; reseller, the domain administrator of a.example (UI 003 US9-AS3).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      setupHistory(state)
      assignDomains(state, 'reseller', ['a.example'])
    },
  },
}
