// The UI 006 factories (T025): every representation they build satisfies the pinned contract, the
// item set covers every kind the stories test, and the hostile corpus has at least 50 vectors that
// fit every field they are used in.
import { describe, expect, it } from 'vitest'

import { contractValidator } from '../../mocks/contract/validator'
import { HOSTILE_VECTORS, hostileQuarantineItems } from '../../mocks/factories/hostile-messages'
import { quarantineAuditEvents } from '../../mocks/factories/quarantine-audit'
import { defaultQuarantineCapabilities } from '../../mocks/factories/quarantine-capabilities'
import {
  aliceQuarantineItems,
  contentStatusOf,
  generateQuarantineItems,
  messageFileName,
  quarantineItemDetails,
  quarantineItemView,
  QUARANTINE_ITEM,
} from '../../mocks/factories/quarantine-item'
import {
  activeQuarantineSettings,
  customQuarantineSettings,
  freshQuarantineSettings,
  quarantineSettingsView,
} from '../../mocks/factories/quarantine-settings'
import { generateEntries, spamPolicyEntryView } from '../../mocks/factories/spam-policy-entry'
import { spamScoreView, reportedSpamScoreDefaults } from '../../mocks/factories/spam-score'
import { rateLimitView } from '../../mocks/factories/rate-limit'
import { spamStatistics, spamStatisticsView } from '../../mocks/factories/spam-statistics'

const validator = contractValidator()
const LIMIT = 10 * 1_048_576
const valid = (schema: string, value: unknown) =>
  validator.validateSchema(`#/components/schemas/${schema}`, value)

describe('quarantine item factory', () => {
  it('builds contract-valid items and details for every kind', () => {
    const items = [
      ...aliceQuarantineItems(),
      ...generateQuarantineItems(['bob@example.org'], 20, 100),
    ]
    for (const item of items) {
      expect(valid('QuarantineItem', quarantineItemView(item))).toEqual([])
      for (const admin of [true, false]) {
        const details = quarantineItemDetails(item, {
          admin,
          attachments: admin,
          contentSizeLimit: LIMIT,
        })
        expect(valid('QuarantineItemDetails', details)).toEqual([])
      }
    }
    const alice = aliceQuarantineItems()
    const byId = (id: number) => alice.find((item) => item.id === id)!
    expect(alice).toHaveLength(30)
    expect(new Set(alice.map((item) => item.action))).toEqual(
      new Set(['rejected', 'junk', 'subjectRewritten', 'other']),
    )
    expect(byId(QUARANTINE_ITEM.virus).virus).toBe(true)
    expect(contentStatusOf(byId(QUARANTINE_ITEM.tooLarge), LIMIT)).toBe('tooLarge')
    expect(contentStatusOf(byId(QUARANTINE_ITEM.missing), LIMIT)).toBe('missing')
    expect(byId(QUARANTINE_ITEM.unparseable).content).toMatchObject({
      textPlain: null,
      parserFallback: true,
    })
    expect(byId(QUARANTINE_ITEM.noScoreNoSubject)).toMatchObject({ score: null, subject: '' })
    const scores = byId(1).symbols.map((symbol) => Math.sign(symbol.score))
    expect(scores).toEqual(expect.arrayContaining([1, -1, 0]))
  })

  it('names a message file from its subject, or its queue identifier', () => {
    const [item] = aliceQuarantineItems()
    expect(messageFileName(item!)).toBe('Your invoice is overdue.eml')
    expect(messageFileName({ ...item!, subject: '' })).toBe(`${item!.queueId}.eml`)
  })
})

describe('hostile corpus', () => {
  it('has at least 50 vectors, each item valid against the contract', () => {
    expect(HOSTILE_VECTORS.length).toBeGreaterThanOrEqual(50)
    expect(new Set(HOSTILE_VECTORS.map((vector) => vector.name)).size).toBe(HOSTILE_VECTORS.length)
    for (const item of hostileQuarantineItems(1000)) {
      expect(valid('QuarantineItem', quarantineItemView(item))).toEqual([])
      const details = quarantineItemDetails(item, {
        admin: true,
        attachments: true,
        contentSizeLimit: LIMIT,
      })
      expect(valid('QuarantineItemDetails', details)).toEqual([])
    }
  })

  it('covers overrides, isolates, controls and oversized text', () => {
    const all = HOSTILE_VECTORS.map((vector) => vector.value).join('')
    for (const char of ['‮', '‭', '⁦', '⁩', '\u0000', '\u0085', '﻿']) {
      expect(all).toContain(char)
    }
    expect(HOSTILE_VECTORS.some((vector) => vector.value.length >= 10_000)).toBe(true)
    expect(HOSTILE_VECTORS.some((vector) => vector.value.split('\n').length >= 5000)).toBe(true)
  })
})

describe('settings, spam policy, rate limit, statistics and capabilities factories', () => {
  it('are valid against the contract', () => {
    const known = new Set(['example.com'])
    for (const settings of [
      freshQuarantineSettings(),
      activeQuarantineSettings(),
      customQuarantineSettings(),
    ]) {
      for (const visibility of ['full', 'public'] as const) {
        expect(
          valid('QuarantineSettings', quarantineSettingsView(settings, visibility, known)),
        ).toEqual([])
      }
    }
    expect(
      quarantineSettingsView(customQuarantineSettings(), 'full', known).missingExcludedDomains,
    ).toEqual(['example.net'])
    expect(quarantineSettingsView(freshQuarantineSettings(), 'full', known)).toMatchObject({
      active: false,
      maxAgeDays: 365,
      releaseFormat: 'original',
      notificationSender: 'quarantine@localhost',
      notificationSubject: 'Spam Quarantine Notification',
      notificationTemplateIsDefault: true,
    })
    for (const entry of generateEntries('domain', 'example.org', 6, 1)) {
      expect(valid('SpamPolicyEntry', spamPolicyEntryView(entry, true))).toEqual([])
    }
    expect(
      valid(
        'SpamScore',
        spamScoreView(
          'alice@example.org',
          { junkScore: 6.5, rejectScore: null },
          reportedSpamScoreDefaults(),
        ),
      ),
    ).toEqual([])
    expect(
      valid(
        'RateLimit',
        rateLimitView('mailbox', 'alice@example.org', null, null, {
          limit: { value: 100, frame: 'hour' },
          source: 'domain',
        }),
      ),
    ).toEqual([])
    expect(valid('SpamFilterActionStatistics', spamStatisticsView(spamStatistics()))).toEqual([])
    expect(spamStatisticsView(spamStatistics()).total).toBe(1000)
    expect(valid('QuarantineCapabilities', defaultQuarantineCapabilities())).toEqual([])
  })

  it('give audit records of all 12 event types of API 006', () => {
    const records = quarantineAuditEvents()
    for (const record of records) expect(valid('AuditEvent', record)).toEqual([])
    expect(new Set(records.map((record) => record.eventType)).size).toBe(12)
  })
})
