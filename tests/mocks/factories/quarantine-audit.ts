// UI 006 (T122, research R23): audit records of the 12 event types of API 006, with the detail keys
// that `docs/audit-events.md` documents for them. Item actions target the item (`quarantineItem`,
// the queue identifier as name); list entries are recorded on their owner (G15) with the entry in
// `details`; one bulk action's records share `bulkRequestId`. No record carries a subject, content
// or template text. `quarantineAuditEvents()` gives one set for the History tests.
import type { AuditEvent, AuditTarget } from '@/api'

import { auditEvent } from './audit-event'

export const BULK_REQUEST_ID = '0f1e2d3c4b5a69788796a5b4c3d2e1f0'
/** The recipient of the release record, with a right-to-left override (R9). */
export const RTL_RECIPIENT = 'alice@example.org‮gro.elpmaxe'

const at = (minute: number) => new Date(Date.UTC(2026, 9, 18, 9, minute)).toISOString()

function target(type: AuditTarget['type'], id: string | null, name: string | null = id) {
  return { type, id, name }
}

export function quarantineAuditEvents(): AuditEvent[] {
  return [
    auditEvent({
      occurredAt: at(1),
      eventType: 'quarantineItemRelease',
      target: target('quarantineItem', '5', 'Q0000000005'),
      details: {
        queueId: 'Q0000000005',
        recipient: RTL_RECIPIENT,
        sender: 'billing@malware.example',
        action: 'release',
        steps: { delivery: 'done', learning: 'failed', fuzzy: 'notRequested' },
      },
    }),
    ...['21', '22'].map((id, index) =>
      auditEvent({
        occurredAt: at(2 + index),
        eventType: 'quarantineItemDeletion',
        target: target('quarantineItem', id, `Q00000000${id}`),
        details: {
          queueId: `Q00000000${id}`,
          recipient: 'bob@example.org',
          sender: 'promo@deals.example',
          bulkRequestId: BULK_REQUEST_ID,
        },
      }),
    ),
    auditEvent({
      occurredAt: at(4),
      eventType: 'quarantineItemSpamLearning',
      target: target('quarantineItem', '3', 'Q0000000003'),
      details: {
        queueId: 'Q0000000003',
        recipient: 'alice@example.org',
        sender: 'sender3@spam.example',
        action: 'learnAsSpam',
        steps: { delivery: 'notApplicable', learning: 'done', fuzzy: 'done' },
      },
    }),
    auditEvent({
      occurredAt: at(5),
      eventType: 'quarantineItemSpamLearning',
      outcome: 'failure',
      failureReason: 'temporaryFailure',
      target: target('quarantineItem', '4', 'Q0000000004'),
      details: {
        queueId: 'Q0000000004',
        recipient: 'alice@example.org',
        sender: 'sender4@spam.example',
        problemType: '/api/v2/problems/temporary-failure',
        status: 503,
      },
    }),
    auditEvent({
      occurredAt: at(6),
      eventType: 'quarantineSettingsUpdate',
      target: target('quarantineSettings', null, null),
      details: {
        changes: {
          retentionPerMailbox: { old: 0, new: 20 },
          maxMessageSize: { old: 0, new: 15_728_640 },
          notificationTemplate: { changed: true, oldSize: 2304, newSize: 2511 },
        },
      },
    }),
    auditEvent({
      occurredAt: at(7),
      eventType: 'quarantineNotificationSettingsUpdate',
      target: target('quarantineNotificationSettings', 'alice@example.org'),
      details: { changes: { frequency: { old: 'hourly', new: 'daily' } } },
    }),
    auditEvent({
      occurredAt: at(8),
      eventType: 'spamScoreUpdate',
      target: target('spamScore', 'alice@example.org'),
      details: {
        changes: { junkScore: { old: null, new: 6.5 }, rejectScore: { old: null, new: 12 } },
      },
    }),
    auditEvent({
      occurredAt: at(9),
      eventType: 'spamScoreReset',
      target: target('spamScore', 'alice@example.org'),
      details: {
        changes: { junkScore: { old: 6.5, new: null }, rejectScore: { old: 12, new: null } },
      },
    }),
    auditEvent({
      occurredAt: at(10),
      eventType: 'spamPolicyEntryCreation',
      target: target('domain', 'example.org'),
      details: { entryId: 1, list: 'block', pattern: '*@spam.example' },
    }),
    auditEvent({
      occurredAt: at(11),
      eventType: 'spamPolicyEntryRemoval',
      target: target('mailbox', 'alice@example.org'),
      details: { entryId: 7, list: 'allow', pattern: '*@friends.example' },
    }),
    auditEvent({
      occurredAt: at(12),
      eventType: 'spamPolicyEntryCreation',
      outcome: 'failure',
      failureReason: 'conflict',
      target: target('aliasDomain', 'example.net'),
      details: {
        list: 'allow',
        pattern: '*@ads.test',
        problemType: '/api/v2/problems/spam-policy-entry-exists',
        status: 409,
      },
    }),
    auditEvent({
      occurredAt: at(13),
      eventType: 'rateLimitUpdate',
      target: target('rateLimit', 'example.org'),
      details: { kind: 'domain', old: null, new: '100 / 1h' },
    }),
    auditEvent({
      occurredAt: at(14),
      eventType: 'rateLimitRemoval',
      target: target('rateLimit', 'alice@example.org'),
      details: { kind: 'mailbox', old: '10 / 1m', new: null },
    }),
    auditEvent({
      occurredAt: at(15),
      eventType: 'rateLimitUpdate',
      outcome: 'failure',
      failureReason: 'permissionDenied',
      actor: { username: 'reseller', role: 'domainAdmin', apiKeyId: null },
      target: target('rateLimit', 'example.com'),
      details: {
        kind: 'domain',
        problemType: '/api/v2/problems/permission-flag-required',
        status: 403,
        requiredFlags: ['ratelimit'],
      },
    }),
    auditEvent({
      occurredAt: at(16),
      eventType: 'rateLimitBucketReset',
      target: target('rateLimitBucket', 'RLabc='),
      details: { countersExisted: true, logEntriesRemoved: 3 },
    }),
  ]
}
