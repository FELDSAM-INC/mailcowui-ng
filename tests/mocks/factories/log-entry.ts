// Log entries of the 12 log types (UI 011 T069): stable cursor ids, every priority and severity,
// decoded multi-line messages, a 2,000-character message without spaces, masked request data and
// calls, watchdog health and message entries, autodiscover services, login labels and rate limit
// entries with valid and missing hashes. Entries are generated newest first from a
// base time, one second apart.
import type {
  AcmeLogEntry,
  AutodiscoverLogEntry,
  CronLogEntry,
  LegacyApiRequestLogEntry,
  LegacyUiActivityLogEntry,
  LoginLogEntry,
  LogSeverity,
  NetfilterLogEntry,
  RateLimitLogEntry,
  SyslogLogEntry,
  WatchdogLogEntry,
} from '@/api'

/** The contract path segments of the 12 log types. */
export const LOG_SLUGS = [
  'postfix',
  'dovecot',
  'sogo',
  'netfilter',
  'autodiscover',
  'watchdog',
  'acme',
  'cron',
  'rate-limits',
  'legacy-api-requests',
  'legacy-ui-activity',
  'logins',
] as const

export type LogSlug = (typeof LOG_SLUGS)[number]

export interface LogEntryOf {
  postfix: SyslogLogEntry
  dovecot: SyslogLogEntry
  sogo: SyslogLogEntry
  netfilter: NetfilterLogEntry
  autodiscover: AutodiscoverLogEntry
  watchdog: WatchdogLogEntry
  acme: AcmeLogEntry
  cron: CronLogEntry
  'rate-limits': RateLimitLogEntry
  'legacy-api-requests': LegacyApiRequestLogEntry
  'legacy-ui-activity': LegacyUiActivityLogEntry
  logins: LoginLogEntry
}

export type MockLogEntry = LogEntryOf[LogSlug]

/** The ids of a log type: `<slug>-<sequence>`, increasing with the time. */
export const CURSOR = /^[a-z-]+-\d{1,9}$/

const PRIORITIES: [string, LogSeverity | null][] = [
  ['info', 'info'],
  ['notice', 'info'],
  ['warning', 'warning'],
  ['err', 'error'],
  ['crit', 'error'],
  ['debug', 'info'],
  ['warn', 'warning'],
  ['emerg', 'error'],
  ['custom', null],
]

/** A message of 2,000 characters without a space (SC-009). */
export const LONG_TOKEN = `token=${'A1b2C3d4'.repeat(249)}`.slice(0, 2000)

const time = (base: number, sequence: number) => new Date(base + sequence * 1000).toISOString()

function syslogMessage(sequence: number): string {
  if (sequence % 97 === 3) return LONG_TOKEN
  if (sequence % 50 === 7) return `decoded message ${sequence}\nsecond line\nthird line`
  if (sequence % 10 === 0)
    return `to=<alice@example.org>, relay=mx.partner.example, status=bounced (${sequence})`
  return `connect from unknown[203.0.113.${sequence % 250}] (${sequence})`
}

/**
 * One entry of a log type with the given sequence number; `base` is the time of sequence 0 in
 * epoch milliseconds.
 */
export function logEntry<S extends LogSlug>(
  slug: S,
  sequence: number,
  base: number,
): LogEntryOf[S] {
  const id = `${slug}-${sequence}`
  const at = time(base, sequence)
  const [priority, severity] = PRIORITIES[sequence % PRIORITIES.length]!
  switch (slug) {
    case 'postfix':
    case 'dovecot':
    case 'sogo': {
      const program =
        slug === 'postfix' ? 'postfix/smtpd' : slug === 'dovecot' ? 'dovecot' : 'sogod'
      const entry: SyslogLogEntry = {
        id,
        time: at,
        priority,
        severity,
        program,
        message: syslogMessage(sequence),
      }
      return entry as LogEntryOf[S]
    }
    case 'netfilter': {
      const entry: NetfilterLogEntry = {
        id,
        time: at,
        priority: ['crit', 'warn', 'info'][sequence % 3]!,
        severity: (['error', 'warning', 'info'] as const)[sequence % 3]!,
        message: `Banned 203.0.113.${sequence % 250}/32 for 1800 seconds (${sequence})`,
      }
      return entry as LogEntryOf[S]
    }
    case 'autodiscover': {
      const entry: AutodiscoverLogEntry = {
        id,
        time: at,
        userAgent: sequence % 4 === 0 ? null : 'Microsoft Office/16.0',
        user: sequence % 5 === 0 ? null : `user${sequence % 7}@example.org`,
        clientAddress: `198.51.100.${sequence % 250}`,
        service: ['activesync', 'imap', 'unknown service'][sequence % 3]!,
      }
      return entry as LogEntryOf[S]
    }
    case 'watchdog': {
      const health = sequence % 3 !== 0
      const entry: WatchdogLogEntry = health
        ? {
            id,
            time: at,
            service: ['Postfix', 'Dovecot', 'ClamAV'][sequence % 3]!,
            healthLevelPercent: 80 + (sequence % 20),
            healthPointsNow: 8 + (sequence % 3),
            healthPointsTotal: 10,
            healthPointsChange: [-2, 0, 1][sequence % 3]!,
            message: null,
          }
        : {
            id,
            time: at,
            service: null,
            healthLevelPercent: null,
            healthPointsNow: null,
            healthPointsTotal: null,
            healthPointsChange: null,
            message: `Restarting container sogo-mailcow (${sequence})`,
          }
      return entry as LogEntryOf[S]
    }
    case 'acme': {
      const entry: AcmeLogEntry = {
        id,
        time: at,
        message: `Certificate validation done (${sequence})`,
      }
      return entry as LogEntryOf[S]
    }
    case 'cron': {
      const entry: CronLogEntry = {
        id,
        time: at,
        task: sequence % 2 === 0 ? 'Keycloak Sync' : 'LDAP Sync',
        priority,
        severity,
        message: `Synchronised ${sequence % 9} mailboxes`,
      }
      return entry as LogEntryOf[S]
    }
    case 'rate-limits': {
      const bucket = sequence % 3
      const entry: RateLimitLogEntry = {
        id,
        time: at,
        rateLimitName: `user_${bucket}`,
        // The API returns legacy's `err` and other non-bucket texts as null (API gap G10 closed).
        rateLimitHash: sequence % 11 === 5 ? null : `RLbucket${bucket}hash`,
        sender: `sender${bucket}@example.org`,
        recipients: [`rcpt${sequence % 4}@partner.example`, 'second@partner.example'],
        user: bucket === 2 ? null : `sender${bucket}@example.org`,
        messageId: `<${sequence}@example.org>`,
        headerFrom: `Sender ${bucket} <sender${bucket}@example.org>`,
        subject: `Newsletter ${sequence}`,
        scannerQueueId: `QID${sequence}`,
        clientAddress: `192.0.2.${bucket + 10}`,
      }
      return entry as LogEntryOf[S]
    }
    case 'legacy-api-requests': {
      const entry: LegacyApiRequestLogEntry = {
        id,
        time: at,
        uri: `/api/v1/edit/mailbox/${sequence}`,
        method: sequence % 2 === 0 ? 'POST' : 'GET',
        clientAddress: '192.0.2.50',
        requestData:
          sequence % 2 === 0
            ? {
                attr: { password: '*', password2: '*', quota: '1024' },
                items: ['alice@example.org'],
              }
            : null,
      }
      return entry as LogEntryOf[S]
    }
    case 'legacy-ui-activity': {
      const entry: LegacyUiActivityLogEntry = {
        id,
        time: at,
        type: ['success', 'danger', 'warning', 'info'][sequence % 4]!,
        task: `task${sequence}`,
        user: sequence % 5 === 0 ? 'admin => alice@example.org' : 'admin',
        role: 'admin',
        clientAddress: '192.0.2.60',
        messageKey: sequence % 6 === 0 ? null : 'object_modified',
        messageParameters: ['alice@example.org'],
        call: ['mailbox', 'edit', { password: '*', quota: 1024 }],
      }
      return entry as LogEntryOf[S]
    }
    case 'logins': {
      const entry: LoginLogEntry = {
        id,
        time: at,
        username: `user${sequence % 7}@example.org`,
        service: ['imap', 'smtp', 'sogo', 'WEBUI'][sequence % 4]!,
        clientAddress: `198.51.100.${sequence % 250}`,
        appPasswordUsed: sequence % 3 === 0,
      }
      return entry as LogEntryOf[S]
    }
  }
  throw new Error(`Unknown log type ${String(slug)}`)
}

/** `count` entries of a log type, newest first, the newest at `newest` (epoch milliseconds). */
export function logEntries<S extends LogSlug>(
  slug: S,
  count: number,
  newest: number,
): LogEntryOf[S][] {
  const base = newest - (count - 1) * 1000
  return Array.from({ length: count }, (_, index) => logEntry(slug, count - 1 - index, base))
}
