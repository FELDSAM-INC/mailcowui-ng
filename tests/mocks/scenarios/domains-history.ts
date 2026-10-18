// UI 002 US8 scenario (T095): the audit records API 002 writes for example.org, its footer and a
// template, next to API key records, so that the History links of the domain, template and API key
// pages and the audit log's target filters can be tested. Times are relative to the moment the
// scenario is created, so the audit log's default range always finds them.
import type { AuditEvent } from '@/api'

import { GIB, mockDomain } from '../factories/domain'
import { mockTemplate } from '../factories/domain-template'
import { auditEvent, domainAuditEvent, refusedDomainAuditEvent } from '../factories/audit-event'
import { scenarioKey } from './api-keys'
import { assignDomains, defaultTemplate, scenarioTime } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

const MINUTE = 60_000

export const HISTORY_DOMAIN = 'example.org'
export const HISTORY_TEMPLATE_ID = 2
export const HISTORY_TEMPLATE_NAME = 'Small'
/** The API key whose History the API key page offers. */
export const HISTORY_KEY = scenarioKey(5, { name: 'Billing system' })

const admin = { username: 'admin', role: 'admin' as const, apiKeyId: null }
const reseller = { username: 'reseller', role: 'domainAdmin' as const, apiKeyId: null }
const domainTarget = { id: HISTORY_DOMAIN, name: HISTORY_DOMAIN }
const templateTarget = { id: String(HISTORY_TEMPLATE_ID), name: HISTORY_TEMPLATE_NAME }

/** The records, newest first, with times relative to `now`. */
export function domainHistoryRecords(now: number): AuditEvent[] {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString()
  return [
    domainAuditEvent('domainFooterUpdate', domainTarget, {
      occurredAt: at(10),
      actor: reseller,
      clientAddress: '198.51.100.7',
      details: {
        changes: {
          html: { changed: true, oldSize: 0, newSize: 24 },
          plain: { changed: true, oldSize: 0, newSize: 12 },
          skipReplies: { old: false, new: true },
        },
      },
    }),
    refusedDomainAuditEvent('domainUpdate', domainTarget, 'attributeNotPermitted', {
      occurredAt: at(20),
      actor: reseller,
      clientAddress: '198.51.100.7',
      details: {
        problemType: '/api/v2/problems/attribute-not-permitted',
        status: 403,
      },
    }),
    domainAuditEvent('domainUpdate', domainTarget, {
      occurredAt: at(30),
      actor: admin,
      clientAddress: '192.0.2.10',
      details: { changes: { domainQuota: { old: 10 * GIB, new: 20 * GIB } } },
    }),
    domainAuditEvent('domainCreation', domainTarget, {
      occurredAt: at(40),
      actor: admin,
      clientAddress: '192.0.2.10',
      details: {
        templateId: 1,
        creationReport: {
          rateLimit: 'notRequested',
          dkimKey: 'created',
          dkimDnsPublication: 'notConfigured',
          groupwareRestart: 'failed',
          messages: { groupwareRestart: 'The groupware container did not restart in time.' },
        },
      },
    }),
    domainAuditEvent(
      'domainTemplateDeletion',
      { id: '9', name: 'Retired' },
      {
        occurredAt: at(50),
        actor: admin,
        details: { values: { maxMailboxes: 1 } },
      },
    ),
    domainAuditEvent('domainTemplateUpdate', templateTarget, {
      occurredAt: at(60),
      actor: admin,
      details: { changes: { maxMailboxes: { old: 3, new: 5 } } },
    }),
    domainAuditEvent('domainTemplateCreation', templateTarget, {
      occurredAt: at(70),
      actor: admin,
      details: { values: { maxMailboxes: 3 } },
    }),
    auditEvent({
      occurredAt: at(80),
      eventType: 'apiKeyCreation',
      actor: admin,
      target: { type: 'apiKey', id: HISTORY_KEY.id, name: HISTORY_KEY.name },
      details: { accessLevel: 'readWrite' },
    }),
    auditEvent({
      occurredAt: at(90),
      eventType: 'apiKeyCreation',
      actor: admin,
      target: { type: 'apiKey', id: scenarioKey(6).id, name: 'Other key' },
      details: { accessLevel: 'readOnly' },
    }),
    auditEvent({
      occurredAt: at(100),
      eventType: 'signIn',
      actor: admin,
      target: { type: 'session', id: null, name: null },
    }),
  ]
}

function setupHistory(state: ScenarioState): void {
  state.domains = [
    mockDomain({ name: HISTORY_DOMAIN, description: 'Example', domainQuota: 20 * GIB }),
    mockDomain({ name: 'example.net' }),
  ]
  state.domainTemplates = [
    defaultTemplate(),
    mockTemplate({
      id: HISTORY_TEMPLATE_ID,
      name: HISTORY_TEMPLATE_NAME,
      createdAt: scenarioTime(2),
    }),
  ]
  state.apiKeys = [HISTORY_KEY]
  state.auditEvents = domainHistoryRecords(Date.now())
  assignDomains(state, 'reseller', [HISTORY_DOMAIN])
}

export const domainsHistoryScenarios: Record<string, ScenarioDefinition> = {
  'audit-domain-records': {
    description:
      'admin is signed in; audit records of example.org (a creation with a failed restart, a quota edit, a refused edit, a footer update), of the template "Small" (creation, update) and a deleted template, and of API keys.',
    setup: setupHistory,
    overrides: { signedInAs: 'admin' },
  },
  'audit-domain-records-domain-admin': {
    description:
      'The same records; reseller, the domain administrator of example.org, is signed in.',
    setup: setupHistory,
    overrides: { signedInAs: 'reseller' },
  },
}
