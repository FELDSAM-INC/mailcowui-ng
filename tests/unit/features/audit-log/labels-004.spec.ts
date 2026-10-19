// The feature 004 audit labels and details (T104, research R19; mailcow-rest-v2
// `docs/audit-events.md` "Feature 004"): the 10 event and 4 target labels, the links back to each
// target, the generic label for an unknown code, and the documented detail keys as text: `changes`
// with their old and new values, `creationReport` and `removed` as their entries, and
// `copiedFromAliasId` as a link; other keys verbatim.
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import { auditDetailRows, auditLabel, auditTargetLink } from '@/features/audit-log/labels'
import { hasMessage, text } from '@/i18n'

const tr = { t: text, te: hasMessage }

const event = (overrides: Partial<AuditEvent>): AuditEvent =>
  ({
    id: 1,
    occurredAt: '2026-10-01T10:00:00Z',
    eventType: 'aliasUpdate',
    outcome: 'success',
    actor: { username: 'admin', role: 'admin', apiKeyId: null },
    clientAddress: '192.0.2.1',
    authMethod: 'password',
    failureReason: null,
    userAgent: null,
    requestId: 'r1',
    target: { type: 'alias', id: '1', name: 'sales@example.org' },
    details: {},
    ...overrides,
  }) as AuditEvent

describe('feature 004 audit labels', () => {
  it('labels the 10 event types and the 4 target types', () => {
    const events = [
      'aliasCreation',
      'aliasUpdate',
      'aliasDeletion',
      'aliasDomainCreation',
      'aliasDomainUpdate',
      'aliasDomainDeletion',
      'resourceCreation',
      'resourceUpdate',
      'resourceDeletion',
      'mailboxSenderSettingsUpdate',
    ]
    for (const code of events) {
      expect(auditLabel('eventType', code, tr)).not.toContain(code)
    }
    expect(auditLabel('eventType', 'somethingNew', tr)).toContain('somethingNew')
  })

  it('links each target back to its object, but not deleted ones', () => {
    expect(auditTargetLink(event({}))).toEqual({ name: 'alias-detail', params: { aliasId: '1' } })
    expect(
      auditTargetLink(
        event({
          eventType: 'aliasDomainUpdate',
          target: { type: 'aliasDomain', id: 'example.net', name: 'example.net' },
        }),
      ),
    ).toEqual({ name: 'alias-domain-detail', params: { aliasDomain: 'example.net' } })
    expect(
      auditTargetLink(
        event({
          eventType: 'resourceUpdate',
          target: { type: 'resource', id: 'Room@example.org', name: 'Room' },
        }),
      ),
    ).toEqual({ name: 'resource-detail', params: { resourceAddress: 'Room@example.org' } })
    expect(
      auditTargetLink(
        event({
          eventType: 'mailboxSenderSettingsUpdate',
          target: {
            type: 'mailboxSenderSettings',
            id: 'anna@example.org',
            name: 'anna@example.org',
          },
        }),
      ),
    ).toEqual({ name: 'mailbox-detail', params: { address: 'anna@example.org' } })
    expect(auditTargetLink(event({ eventType: 'aliasDeletion' }))).toBeNull()
  })

  it('shows the documented detail keys as text and the others verbatim', () => {
    const rows = auditDetailRows(
      event({
        details: {
          changes: {
            destinations: { old: ['a@example.org'], new: ['a@example.org', 'b@example.org'] },
          },
          removed: { aliases: 7, bccMaps: 0 },
          creationReport: { dkimKey: 'created', rateLimit: 'notRequested' },
          copiedFromAliasId: 2,
          somethingElse: { x: 1 },
        },
      }),
    )
    expect(rows.find((row) => row.key === 'changes')?.lines).toEqual([
      'destinations: a@example.org → a@example.org, b@example.org',
    ])
    expect(rows.find((row) => row.key === 'removed')?.lines).toEqual(['aliases: 7', 'bccMaps: 0'])
    expect(rows.find((row) => row.key === 'creationReport')?.lines).toEqual([
      'dkimKey: created',
      'rateLimit: notRequested',
    ])
    expect(rows.find((row) => row.key === 'copiedFromAliasId')?.link).toEqual({
      name: 'alias-detail',
      params: { aliasId: '2' },
    })
    expect(rows.find((row) => row.key === 'somethingElse')?.lines).toEqual(['{"x":1}'])
  })
})
