// Rspamd statistics and scan history (UI 011 T117): every action as Rspamd names it, symbols with
// positive, negative and zero scores, and a rejected message from `spammer@example.net`.
import type { RspamdHistoryEntry, RspamdStatistics } from '@/api'

export const RSPAMD_ACTIONS = [
  'no action',
  'add header',
  'rewrite subject',
  'greylist',
  'soft reject',
  'reject',
] as const

export function rspamdStatistics(collectedAt: string, zero = false): RspamdStatistics {
  const counts = zero ? [0, 0, 0, 0, 0, 0] : [820, 90, 10, 40, 15, 25]
  return {
    scanned: counts.reduce((sum, count) => sum + count, 0),
    learned: zero ? 0 : 42,
    spamCount: zero ? 0 : 125,
    hamCount: zero ? 0 : 875,
    actions: Object.fromEntries(RSPAMD_ACTIONS.map((action, index) => [action, counts[index]!])),
    connections: zero ? 0 : 1000,
    controlConnections: zero ? 0 : 12,
    statfiles: [
      { symbol: 'BAYES_SPAM', type: 'redis', revision: 30, users: 1 },
      { symbol: 'BAYES_HAM', type: 'redis', revision: 12, users: 1 },
    ],
    fuzzyHashes: { 'mailcow fuzzy': zero ? 0 : 1500 },
    collectedAt,
  }
}

/** The rejected message of US6-AS1. */
export function rejectedEntry(time: string): RspamdHistoryEntry {
  return {
    time,
    clientAddress: '203.0.113.66',
    envelopeSender: 'spammer@example.net',
    headerSender: 'Totally Legit <spammer@example.net>',
    envelopeRecipients: ['alice@example.org'],
    headerRecipients: ['alice@example.org'],
    subject: 'You won <b>1,000,000</b>',
    action: 'reject',
    score: 18.37,
    requiredScore: 15,
    symbols: [
      { name: 'BAYES_SPAM', score: 5.1, options: ['99.99%'] },
      { name: 'RBL_SPAMHAUS', score: 4, options: ['66.113.0.203.zen.spamhaus.org'] },
      { name: 'DMARC_POLICY_ALLOW', score: -0.5, options: ['example.net', 'none'] },
      { name: 'ARC_NA', score: 0, options: [] },
    ],
    sizeBytes: 48_213,
    scanTimeRealSeconds: 0.412,
    scanTimeVirtualSeconds: 0.05,
    messageId: '<spam-1@example.net>',
    user: null,
  }
}

/** `count` history entries, newest first, the newest at `newest` (epoch milliseconds). */
export function rspamdHistory(count: number, newest: number): RspamdHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const action = RSPAMD_ACTIONS[index % RSPAMD_ACTIONS.length]!
    return {
      time: new Date(newest - index * 60_000).toISOString(),
      clientAddress: index % 9 === 4 ? null : `198.51.100.${index % 250}`,
      envelopeSender: `sender${index}@example.com`,
      headerSender: index % 7 === 3 ? null : `Sender ${index} <sender${index}@example.com>`,
      envelopeRecipients: [`user${index % 5}@example.org`],
      headerRecipients: index % 2 === 0 ? [`user${index % 5}@example.org`] : [],
      subject: index % 8 === 5 ? null : `Message ${index}`,
      action,
      score: Math.round(((index * 7) % 30) * 10 - 20) / 10,
      requiredScore: 15,
      symbols: [
        { name: 'MIME_GOOD', score: -0.1, options: ['text/plain'] },
        { name: 'ARC_NA', score: 0, options: [] },
      ],
      sizeBytes: 1000 + index * 517,
      scanTimeRealSeconds: 0.1 + (index % 10) / 100,
      scanTimeVirtualSeconds: index % 4 === 0 ? null : 0.02,
      messageId: `<message-${index}@example.com>`,
      user: index % 3 === 0 ? `user${index % 5}@example.org` : null,
    }
  })
}
