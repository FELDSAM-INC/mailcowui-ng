// Mail queue factory (UI 011 T085): queued messages in all five queues with hexadecimal queue IDs,
// recipients with and without deferral reasons, bounces with an empty sender, `forcedExpiry` true,
// false and null, and content of a given size (up to 10 MiB, with multi-byte characters).
import type { MailQueueMessage, MailQueueName } from '@/api'

export interface MockQueueMessage extends MailQueueMessage {
  /** The content `postcat -q` shows; generated from the message when absent. */
  content?: string
  /** Generates content of about this many UTF-16 code units (large messages). */
  contentLength?: number
}

const MINUTE = 60_000

/** A queue ID: hexadecimal, as Postfix's short format. */
export function queueId(index: number, prefix = 'A'): string {
  return `${prefix}${index.toString(16).toUpperCase().padStart(9, '0')}`
}

export function queueMessage(
  now: number,
  changes: Partial<MockQueueMessage> & Pick<MockQueueMessage, 'id'>,
): MockQueueMessage {
  return {
    queue: 'deferred',
    arrivalTime: new Date(now - 30 * MINUTE).toISOString(),
    sizeBytes: 2_048,
    sender: 'alice@example.org',
    recipients: [{ address: 'bob@example.net', deferralReason: null }],
    forcedExpiry: false,
    ...changes,
  }
}

const PARTNER_REASON = 'connect to mx.partner.example[192.0.2.25]:25: Connection timed out'

/** The healthy installation's queue: 8 messages, 3 of them deferred to `partner.example`. */
export function standardQueue(now: number): MockQueueMessage[] {
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString()
  return [
    queueMessage(now, {
      id: '4F2A1B3C9D',
      queue: 'deferred',
      arrivalTime: at(240),
      sizeBytes: 18_432,
      sender: 'alice@example.org',
      recipients: [
        { address: 'carol@partner.example', deferralReason: PARTNER_REASON },
        { address: 'dave@partner.example', deferralReason: PARTNER_REASON },
        { address: 'erin@example.net', deferralReason: null },
      ],
    }),
    queueMessage(now, {
      id: '5B0C2D4E1F',
      queue: 'deferred',
      arrivalTime: at(180),
      sizeBytes: 4_096,
      sender: 'bob@example.org',
      recipients: [{ address: 'frank@partner.example', deferralReason: PARTNER_REASON }],
      forcedExpiry: true,
    }),
    queueMessage(now, {
      id: '6C1D3E5F20',
      queue: 'deferred',
      arrivalTime: at(120),
      sizeBytes: 1_200,
      sender: 'carol@example.org',
      recipients: [{ address: 'grace@partner.example', deferralReason: PARTNER_REASON }],
      forcedExpiry: null,
    }),
    queueMessage(now, {
      id: '7D2E4F6031',
      queue: 'deferred',
      arrivalTime: at(90),
      sizeBytes: 8_000,
      sender: '',
      recipients: [
        {
          address: 'nobody@example.org',
          deferralReason: 'host mail.example.org[198.51.100.20] said: 450 4.2.0 Mailbox busy',
        },
      ],
    }),
    queueMessage(now, {
      id: '8E3F507142',
      queue: 'hold',
      arrivalTime: at(60),
      sizeBytes: 512,
      sender: 'newsletter@example.org',
      recipients: [{ address: 'list@example.com', deferralReason: null }],
    }),
    queueMessage(now, {
      id: '9F40618253',
      queue: 'active',
      arrivalTime: at(5),
      sizeBytes: 3_100,
      sender: 'dave@example.org',
      recipients: [{ address: 'henry@example.com', deferralReason: null }],
    }),
    queueMessage(now, {
      id: 'A051729364',
      queue: 'incoming',
      arrivalTime: at(2),
      sizeBytes: 900,
      sender: 'erin@example.org',
      recipients: [{ address: 'ivy@example.com', deferralReason: null }],
    }),
    queueMessage(now, {
      id: 'B162830475',
      queue: 'maildrop',
      arrivalTime: at(1),
      sizeBytes: 650,
      sender: 'frank@example.org',
      recipients: [{ address: 'jack@example.com', deferralReason: null }],
    }),
  ]
}

/** 10,000 listed messages, 1,400 of them held from one compromised sender. */
export function largeQueue(now: number): MockQueueMessage[] {
  const messages: MockQueueMessage[] = []
  for (let index = 0; index < 10_000; index += 1) {
    const spam = index < 1_400
    messages.push({
      id: queueId(index + 1, spam ? 'C' : 'D'),
      queue: spam ? 'hold' : ('deferred' satisfies MailQueueName),
      arrivalTime: new Date(now - (10_000 - index) * MINUTE).toISOString(),
      sizeBytes: 1_000 + (index % 50) * 100,
      sender: spam ? 'spam@compromised.example' : `user${index % 40}@example.org`,
      recipients: [
        {
          address: `rcpt${index % 97}@example.net`,
          deferralReason: spam ? null : 'Connection refused',
        },
      ],
      forcedExpiry: false,
    })
  }
  return messages
}

/** `postcat -q` output: envelope records, headers and a body (with multi-byte characters). */
export function messageContent(message: MockQueueMessage): string {
  if (message.content !== undefined) return message.content
  const header = [
    '*** ENVELOPE RECORDS deferred/' + message.id + ' ***',
    `message_size:            ${message.sizeBytes}             0               1               0`,
    `sender: ${message.sender}`,
    ...message.recipients.map((recipient) => `recipient: ${recipient.address}`),
    '*** MESSAGE CONTENTS deferred/' + message.id + ' ***',
    `From: <${message.sender}>`,
    `To: ${message.recipients.map((recipient) => `<${recipient.address}>`).join(', ')}`,
    'Subject: <b>Quarterly report</b> – Příliš žluťoučký kůň',
    'Content-Type: text/plain; charset=utf-8',
    '',
  ].join('\n')
  if (message.contentLength === undefined) {
    return `${header}Hello,\n\nthe report is attached.\n\n<script>alert(1)</script>\n*** HEADER EXTRACTED ***\n`
  }
  const line = 'Ünïcödé line of a large attachment 😀 0123456789abcdefghijklmnopqrstuvwxyz\n'
  const body = line.repeat(Math.ceil(message.contentLength / line.length))
  return `${header}${body}`.slice(0, message.contentLength)
}
