// UI 006 (T025, research R28): quarantine items and their representations. An item is a mailcow
// `quarantine` row with its parsed message; `getQuarantineItem` derives `contentStatus` from the
// stored size and the content limit, hides attachment details from callers who may not download
// them, and gives `authenticatedSender` to administrators only. Downloads return deterministic bytes
// (the attachment's `data`, or a small RFC 5322 message), so tests can compare them.
import { createHash } from 'node:crypto'

import type {
  QuarantineAttachment,
  QuarantineItem,
  QuarantineItemAction,
  QuarantineItemDetails,
  QuarantineSymbol,
} from '@/api'

import type {
  MockQuarantineAttachment,
  MockQuarantineContent,
  MockQuarantineItem,
} from '../scenarios/state'

export const MIB = 1_048_576

/** The stored `quarantine.action` of each API action (`other` keeps its own text). */
export const FILTER_ACTIONS: Record<QuarantineItemAction, string> = {
  rejected: 'reject',
  junk: 'add header',
  subjectRewritten: 'rewrite subject',
  other: 'soft reject',
}

/** Arrival times grow with the item ID, so "newest first" is "highest ID first". */
export function arrivalOf(id: number): string {
  return new Date(Date.UTC(2026, 9, 1, 6) + id * 37 * 60_000).toISOString()
}

export function defaultSymbols(score: number | null): QuarantineSymbol[] {
  // Stored order is deliberately unsorted: the item page sorts as legacy does (FR-022).
  return [
    { name: 'MIME_GOOD', score: -0.1, options: ['text/plain'] },
    { name: 'ARC_NA', score: 0, options: [] },
    { name: 'BAYES_SPAM', score: 5.1, options: ['99.12%'] },
    { name: 'RCVD_NO_TLS_LAST', score: 0.1, options: [] },
    { name: 'DMARC_POLICY_ALLOW', score: -0.5, options: ['example.org', 'none'] },
    { name: 'MANY_INVISIBLE_PARTS', score: score === null ? 0 : 1.2, options: ['4'] },
  ]
}

export function defaultContent(
  item: Pick<MockQuarantineItem, 'id' | 'subject' | 'sender' | 'recipient'>,
): MockQuarantineContent {
  return {
    from: `Sender ${item.id} <${item.sender || `sender${item.id}@spam.example`}>`,
    subject: item.subject,
    recipients: [
      { address: item.recipient, source: 'to' },
      { address: item.recipient, source: 'envelope' },
    ],
    textPlain: `Hello,\n\nthis is quarantined message ${item.id}.\n\nRegards`,
    textFromHtml: `Hello, this is quarantined message ${item.id}. Regards`,
    parserFallback: false,
    attachments: [],
  }
}

/** A stored item with defaults for every member not given. */
export function mockQuarantineItem(
  overrides: Partial<MockQuarantineItem> & { id: number; recipient: string },
): MockQuarantineItem {
  const id = overrides.id
  const action = overrides.action ?? 'rejected'
  const score = overrides.score === undefined ? 12.5 : overrides.score
  const base = {
    id,
    queueId: `Q${id.toString(16).toUpperCase().padStart(10, '0')}`,
    subject: `Quarantined message ${id}`,
    sender: `sender${id}@spam.example`,
    recipient: overrides.recipient.toLowerCase(),
    score,
    action,
    filterAction: FILTER_ACTIONS[action],
    virus: false,
    notified: false,
    arrivedAt: arrivalOf(id),
    sourceAddress: '198.51.100.23',
    authenticatedSender: null,
    symbols: defaultSymbols(score),
    fuzzyHashes: [`1:${id}a7c3f0e9:${id}b`, `1:${id}d0e1f2a3:${id}c`],
    size: 4096,
  }
  const merged = { ...base, ...overrides, recipient: overrides.recipient.toLowerCase() }
  const content =
    overrides.content === undefined ? defaultContent(merged) : (overrides.content ?? null)
  return { ...merged, content }
}

/** The version tag over the item's identifying values (identifier, queue ID, recipient, arrival). */
export function quarantineItemEtag(item: MockQuarantineItem): string {
  const key = JSON.stringify([item.id, item.queueId, item.recipient, item.arrivedAt])
  return `"q${createHash('sha256').update(key).digest('hex').slice(0, 23)}"`
}

export function quarantineItemView(item: MockQuarantineItem): QuarantineItem {
  return {
    id: item.id,
    queueId: item.queueId,
    subject: item.subject,
    sender: item.sender,
    recipient: item.recipient,
    score: item.score,
    action: item.action,
    filterAction: item.filterAction,
    virus: item.virus,
    notified: item.notified,
    arrivedAt: item.arrivedAt,
    etag: quarantineItemEtag(item),
  }
}

export const attachmentBytes = (attachment: MockQuarantineAttachment): Buffer =>
  Buffer.from(attachment.data, 'utf8')

export function attachmentView(
  attachment: MockQuarantineAttachment,
  position: number,
): QuarantineAttachment {
  const bytes = attachmentBytes(attachment)
  return {
    position,
    fileName: attachment.fileName || `attachment-${position}`,
    contentType: attachment.contentType,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

export type ContentStatus = QuarantineItemDetails['contentStatus']

export function contentStatusOf(item: MockQuarantineItem, contentSizeLimit: number): ContentStatus {
  if (item.size > contentSizeLimit) return 'tooLarge'
  return item.content ? 'available' : 'missing'
}

/**
 * The representation of `getQuarantineItem`: attachments only for callers who may download them
 * (`null` otherwise), `authenticatedSender` for administrators only.
 */
export function quarantineItemDetails(
  item: MockQuarantineItem,
  options: { admin: boolean; attachments: boolean; contentSizeLimit: number },
): QuarantineItemDetails {
  const status = contentStatusOf(item, options.contentSizeLimit)
  const content = status === 'available' && item.content ? item.content : null
  return {
    ...quarantineItemView(item),
    sourceAddress: item.sourceAddress,
    ...(options.admin ? { authenticatedSender: item.authenticatedSender } : {}),
    symbols: item.symbols.map((symbol) => ({ ...symbol, options: [...symbol.options] })),
    fuzzyHashes: [...item.fuzzyHashes],
    size: item.size,
    contentStatus: status,
    content: content
      ? {
          from: content.from,
          subject: content.subject,
          recipients: content.recipients.map((recipient) => ({ ...recipient })),
          textPlain: content.textPlain,
          textFromHtml: content.textFromHtml,
          parserFallback: content.parserFallback,
          attachments: options.attachments
            ? content.attachments.map((attachment, position) =>
                attachmentView(attachment, position),
              )
            : null,
        }
      : null,
  }
}

/** The stored message as the whole-message download returns it. */
export function messageBytes(item: MockQuarantineItem): Buffer {
  const from = item.content?.from ?? item.sender
  const body = item.content?.textPlain ?? item.content?.textFromHtml ?? ''
  return Buffer.from(
    `From: ${from}\r\nTo: ${item.recipient}\r\nSubject: ${item.subject}\r\n` +
      `Message-ID: <${item.queueId}@mock.example>\r\nMIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n${body.replace(/\r?\n/g, '\r\n')}\r\n`,
    'utf8',
  )
}

/** The `.eml` name as the API derives it: the subject without tags and unsafe characters, ≤ 30. */
export function messageFileName(item: MockQuarantineItem): string {
  const cleaned = item.subject
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069/\\:*?"<>|]/g, '')
    .trim()
    .slice(0, 30)
    .trim()
  return `${cleaned || item.queueId}.eml`
}

/** `attachment; filename="…"; filename*=UTF-8''…` with an ASCII fallback. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/** The four headers every download carries (contract `QuarantineMessageDownload`). */
export function downloadHeaders(fileName: string, contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Disposition': contentDisposition(fileName),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
  }
}

// ---------------------------------------------------------------------------------------------
// The 30 items of alice@example.org (`quarantine-mailbox-user`)

export const ALICE = 'alice@example.org'

/** Notable items of `aliceQuarantineItems()`, by ID. */
export const QUARANTINE_ITEM = {
  rejected: 1,
  junk: 2,
  subjectRewritten: 3,
  /** `action: other`, stored `soft reject`. */
  other: 4,
  /** Virus found (`VIRUS_FOUND`, Eicar), with two attachments. */
  virus: 5,
  /** Two attachments: report.pdf and data.csv. */
  attachments: 6,
  notified: 7,
  /** No score and an empty subject. */
  noScoreNoSubject: 8,
  /** Unparseable: `parserFallback`, `textPlain` null. */
  unparseable: 9,
  /** The stored message is missing (`contentStatus: missing`). */
  missing: 10,
  /** `<script>alert(1)</script>` and a link in subject and text. */
  script: 11,
  /** Markup and a remote image in the text converted from HTML. */
  markup: 12,
  /** A right-to-left override in the subject and an attachment name, Arabic text. */
  rightToLeft: 13,
  /** 60 lines of plain text (the 20-line preview). */
  longText: 14,
  /** 12 MiB, over the 10 MiB content limit (`contentStatus: tooLarge`). */
  tooLarge: 29,
  /** The newest item. */
  newest: 30,
} as const

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

/** alice's 30 items of every kind (ids 1-30, newest is 30). */
export function aliceQuarantineItems(recipient = ALICE): MockQuarantineItem[] {
  const item = (id: number, overrides: Partial<MockQuarantineItem> = {}) =>
    mockQuarantineItem({ id, recipient, ...overrides })
  const withContent = (
    id: number,
    overrides: Partial<MockQuarantineItem>,
    content: Partial<MockQuarantineContent>,
  ) => {
    const base = item(id, overrides)
    return { ...base, content: { ...defaultContent(base), ...content } }
  }
  const items: MockQuarantineItem[] = [
    item(1, { action: 'rejected', score: 15.2, subject: 'Your invoice is overdue' }),
    item(2, { action: 'junk', score: 7.3, subject: 'Weekly newsletter' }),
    item(3, {
      action: 'subjectRewritten',
      score: 6.1,
      subject: '***SPAM*** Cheap watches',
      filterAction: 'rewrite subject',
    }),
    item(4, { action: 'other', filterAction: 'soft reject', score: 4.2, subject: 'Greylisted' }),
    withContent(
      5,
      {
        action: 'rejected',
        score: 1500,
        virus: true,
        subject: 'Invoice attached',
        sender: 'billing@malware.example',
        symbols: [
          { name: 'VIRUS_FOUND', score: 1500, options: ['Eicar-Signature'] },
          ...defaultSymbols(1500),
        ],
      },
      {
        attachments: [
          { fileName: 'eicar.com', contentType: 'application/octet-stream', data: EICAR },
          { fileName: 'invoice.pdf', contentType: 'application/pdf', data: '%PDF-1.4 invoice' },
        ],
      },
    ),
    withContent(
      6,
      { action: 'junk', score: 8.4, subject: 'Quarterly report' },
      {
        attachments: [
          { fileName: 'report.pdf', contentType: 'application/pdf', data: '%PDF-1.4 report' },
          { fileName: 'data.csv', contentType: 'text/csv', data: 'a,b,c\n1,2,3\n' },
        ],
      },
    ),
    item(7, { action: 'rejected', score: 18, notified: true, subject: 'Already notified' }),
    item(8, { score: null, subject: '', action: 'rejected' }),
    withContent(
      9,
      { action: 'junk', score: 9.9, subject: 'Unparseable message' },
      {
        textPlain: null,
        parserFallback: true,
        textFromHtml: 'Raw body that could not be parsed.',
      },
    ),
    item(10, { action: 'rejected', score: 11, subject: 'Stored message missing', content: null }),
    withContent(
      11,
      {
        action: 'rejected',
        score: 22.5,
        subject: '<script>alert(1)</script> Reset your password',
        sender: 'security@phish.example',
      },
      {
        from: '"<script>alert(1)</script>" <security@phish.example>',
        textPlain:
          'Dear user,\n<script>alert(1)</script>\nLog in at https://phish.example/login to keep your account.\n',
        textFromHtml:
          'Dear user, <script>alert(1)</script> Log in at https://phish.example/login now.',
      },
    ),
    withContent(
      12,
      { action: 'junk', score: 6.6, subject: 'Look at <b>this</b> offer' },
      {
        textFromHtml:
          '<img src="https://tracker.example/pixel.gif" onerror="window.__xss=1"> <a href="javascript:window.__xss=1">Click</a>',
      },
    ),
    withContent(
      13,
      {
        action: 'rejected',
        score: 13.3,
        subject: 'invoice\u202Efdp.exe',
        sender: 'arabic@rtl.example',
      },
      {
        from: 'مرحبا <arabic@rtl.example>',
        textPlain: 'مرحبا بالعالم\nHello \u202Ereversed text\u202C done\n',
        attachments: [
          {
            fileName: 'invoice\u202Efdp.exe',
            contentType: 'application/x-msdownload',
            data: 'MZ fake executable',
          },
        ],
      },
    ),
    withContent(
      14,
      { action: 'junk', score: 5.5, subject: 'A long message' },
      {
        textPlain: Array.from({ length: 60 }, (_, line) => `Line ${line + 1} of the text`).join(
          '\n',
        ),
      },
    ),
  ]
  const senders = ['promo@deals.example', 'news@letters.example', 'no-reply@bulk.example']
  for (let id = 15; id <= 28; id += 1) {
    const action: QuarantineItemAction = id % 3 === 0 ? 'junk' : 'rejected'
    items.push(
      item(id, {
        action,
        score: Math.round((5 + ((id * 7) % 20)) * 10) / 10,
        sender: senders[id % senders.length]!,
        subject: `Offer number ${id}`,
        notified: id % 4 === 0,
      }),
    )
  }
  items.push(item(29, { action: 'rejected', score: 30, subject: 'Large message', size: 12 * MIB }))
  items.push(item(30, { action: 'rejected', score: 16.4, subject: 'Newest quarantined message' }))
  return items
}

// ---------------------------------------------------------------------------------------------
// Generated items (`quarantine-many`)

/** A seeded pseudo-random generator (mulberry32), so generated items are the same every run. */
function seeded(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const ACTIONS: QuarantineItemAction[] = ['rejected', 'junk', 'subjectRewritten', 'rejected']

/** `count` items spread over the recipients, ids from `startId`, deterministic for a seed. */
export function generateQuarantineItems(
  recipients: readonly string[],
  count: number,
  startId: number,
  seed = 6,
): MockQuarantineItem[] {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)]!
    const scored = random() > 0.05
    return mockQuarantineItem({
      id,
      recipient: recipients[index % recipients.length]!,
      action,
      score: scored ? Math.round((3 + random() * 30) * 10) / 10 : null,
      virus: random() < 0.08,
      notified: random() < 0.3,
      subject: `Bulk offer ${id}`,
      sender: `bulk${Math.floor(random() * 40)}@sender.example`,
    })
  })
}
