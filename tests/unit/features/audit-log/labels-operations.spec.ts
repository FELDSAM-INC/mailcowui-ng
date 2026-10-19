// UI 011 T138 (FR-075): the labels of this feature's 17 event types, 7 targets and 2 failure
// reasons; the two ban service targets use legacy's section names. Unknown codes stay generic.
import { describe, expect, it } from 'vitest'

import { auditEventTypeValues, auditTargetTypeValues } from '@/api'
import { auditLabel } from '@/features/audit-log/labels'
import { hasMessage, text } from '@/i18n'

const tr = { t: text, te: hasMessage }

const EVENTS = auditEventTypeValues.filter((value) => /^(container|mailQueue|fail2ban)/.test(value))
const TARGETS = auditTargetTypeValues.filter((value) => /^(container|mailQueue|fail2ban)/.test(value))

describe('UI 011 audit labels', () => {
  it('translates every event type of the feature', () => {
    expect(EVENTS).toHaveLength(17)
    for (const value of EVENTS) {
      expect(auditLabel('eventType', value, tr), value).not.toMatch(/Unknown|\(.*\)$/)
    }
    expect(auditLabel('eventType', 'containerRestart', tr)).toBe('Container restarted')
    expect(auditLabel('eventType', 'mailQueuePurge', tr)).toBe('All queued messages deleted')
    expect(auditLabel('eventType', 'fail2banBanListIdRotation', tr)).toBe('Banlist ID refreshed')
  })

  it('translates the seven targets, two of them with the classic names', () => {
    expect(TARGETS).toHaveLength(7)
    expect(TARGETS.map((value) => auditLabel('targetType', value, tr))).toEqual([
      'Container',
      'Mail queue',
      'Queued message',
      'Fail2ban parameters',
      'Regex filters',
      'Active ban',
      'Banlist ID',
    ])
  })

  it('translates the failure reasons of the feature', () => {
    expect(auditLabel('failureReason', 'serviceFailure', tr)).toBe(
      'The container service or Postfix reported an error',
    )
    expect(auditLabel('failureReason', 'rulesNotRestored', tr)).toBe(
      'Default regex filters were not restored in time',
    )
  })

  it('still shows an unknown code generically', () => {
    expect(auditLabel('eventType', 'containerTeleport', tr)).toContain('containerTeleport')
  })
})
