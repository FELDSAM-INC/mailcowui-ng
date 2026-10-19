// UI 004 US8 scenarios (T102): audit records of the 10 feature 004 event types and the 4 target
// types, with contract values only, for the History links of the alias, alias domain, resource and
// "Send as" screens. Times are relative to the moment the scenario is created, so the audit log's
// default range always finds them.
import type { AuditEvent } from '@/api'

import { auditEvent } from '../factories/audit-event'
import { ALIAS_004, DOMAIN_ADMIN_004, MAILBOX_004, RESOURCE_004 } from './feature-004-base'
import type { ScenarioDefinition } from './index'
import { setupSenderWorld } from './sender-settings'

const MINUTE = 60_000

export const HISTORY_004 = {
  alias: { type: 'alias', id: String(ALIAS_004.sales), name: 'sales@example.org' },
  aliasDomain: { type: 'aliasDomain', id: 'example.net', name: 'example.net' },
  resource: { type: 'resource', id: RESOURCE_004.meetingRoom, name: 'Meeting Room 1' },
  senderSettings: { type: 'mailboxSenderSettings', id: MAILBOX_004.anna, name: MAILBOX_004.anna },
} as const

/** The records, newest first. */
export function feature004HistoryRecords(now: number): AuditEvent[] {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString()
  const admin = { username: 'admin', role: 'admin' as const, apiKeyId: null }
  const target = (key: keyof typeof HISTORY_004) => ({ ...HISTORY_004[key] })
  return [
    auditEvent({
      occurredAt: at(5),
      actor: admin,
      eventType: 'mailboxSenderSettingsUpdate',
      target: target('senderSettings'),
      details: {
        changes: {
          explicitPermissions: { old: ['@example.com'], new: ['@example.com', 'info@example.org'] },
        },
      },
    }),
    auditEvent({
      occurredAt: at(10),
      actor: admin,
      eventType: 'resourceDeletion',
      target: { type: 'resource', id: 'OldRoom@example.org', name: 'Old Room' },
      details: {},
    }),
    auditEvent({
      occurredAt: at(15),
      actor: admin,
      eventType: 'resourceUpdate',
      target: target('resource'),
      details: {
        changes: {
          bookingRule: { old: 'unlimited', new: 'limited' },
          bookingLimit: { old: null, new: 2 },
        },
      },
    }),
    auditEvent({
      occurredAt: at(20),
      actor: admin,
      eventType: 'resourceCreation',
      target: target('resource'),
      details: {},
    }),
    auditEvent({
      occurredAt: at(25),
      actor: admin,
      eventType: 'aliasDomainDeletion',
      target: { type: 'aliasDomain', id: 'old-brand.example', name: 'old-brand.example' },
      details: { removed: { aliases: 7, temporaryAliases: 1, bccMaps: 0, spamListEntries: 2 } },
    }),
    auditEvent({
      occurredAt: at(30),
      actor: admin,
      eventType: 'aliasDomainUpdate',
      target: target('aliasDomain'),
      details: { changes: { active: { old: true, new: false } } },
    }),
    auditEvent({
      occurredAt: at(35),
      actor: admin,
      eventType: 'aliasDomainCreation',
      target: target('aliasDomain'),
      details: {
        creationReport: {
          rateLimit: 'notRequested',
          dkimKey: 'created',
          dkimDnsPublication: 'notConfigured',
          groupwareDirectoryUpdate: 'done',
        },
      },
    }),
    auditEvent({
      occurredAt: at(40),
      actor: admin,
      eventType: 'aliasDeletion',
      target: { type: 'alias', id: '99', name: 'old@example.org' },
      details: {},
    }),
    auditEvent({
      occurredAt: at(45),
      actor: admin,
      eventType: 'aliasUpdate',
      target: target('alias'),
      details: {
        changes: {
          destinations: { old: ['anna@example.org'], new: ['anna@example.org', 'bob@example.org'] },
        },
      },
    }),
    auditEvent({
      occurredAt: at(50),
      actor: admin,
      eventType: 'aliasCreation',
      target: target('alias'),
      details: {},
    }),
    auditEvent({
      occurredAt: at(55),
      actor: admin,
      eventType: 'aliasCreation',
      target: { type: 'alias', id: String(ALIAS_004.infoNet), name: 'info@example.net' },
      details: { copiedFromAliasId: ALIAS_004.info },
    }),
  ]
}

export const history004Scenarios: Record<string, ScenarioDefinition> = {
  'history-004': {
    description:
      'An administrator in the base world with audit records of the 10 feature 004 event types (HISTORY_004 targets) (UI 004 US8).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      // With the UI 003 mailboxes, so that the mailbox page with "Allow to send as" opens.
      setupSenderWorld(state)
      state.auditEvents = feature004HistoryRecords(state.now())
    },
  },
  'history-004-da': {
    description:
      'The same records as the domain administrator, who has no History control (US8-AS2).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: (state) => {
      // With the UI 003 mailboxes, so that the mailbox page with "Allow to send as" opens.
      setupSenderWorld(state)
      state.auditEvents = feature004HistoryRecords(state.now())
    },
  },
}
