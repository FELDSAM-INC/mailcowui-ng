// The 12 log types (research R11, data-model §2 LogTypeDescriptor; plan "Decisions at
// implementation" items 5, 10 and 12): legacy's order and groups of the log dropdown, legacy's names
// (new strings with its hard-coded text), the contract operation, the retention key, and legacy's
// columns in legacy's order (`draw_*_logs` in `js/site/dashboard.js`). Columns that legacy hides in a
// child row on narrow screens or always (`className: 'none'`) are details: in the table, those
// legacy always hides and those that would make the table scroll; on cards, everything that is not
// on the card's first line or its main text. Values are shown as returned; the cell kinds only say
// how (text, a priority with its severity class, a trend, …).
import type {
  AcmeLogEntry,
  AutodiscoverLogEntry,
  CronLogEntry,
  LegacyApiRequestLogEntry,
  LegacyUiActivityLogEntry,
  LoginLogEntry,
  LogSeverity,
  MonitoringCapabilities,
  NetfilterLogEntry,
  RateLimitLogEntry,
  SyslogLogEntry,
  WatchdogLogEntry,
} from '@/api'
import { legacy, type TextRef } from '@/i18n'

export type LogSlug =
  | 'postfix'
  | 'dovecot'
  | 'sogo'
  | 'netfilter'
  | 'autodiscover'
  | 'watchdog'
  | 'acme'
  | 'cron'
  | 'rate-limits'
  | 'legacy-api-requests'
  | 'legacy-ui-activity'
  | 'logins'

export type LogEntry =
  | SyslogLogEntry
  | NetfilterLogEntry
  | AutodiscoverLogEntry
  | WatchdogLogEntry
  | AcmeLogEntry
  | CronLogEntry
  | RateLimitLogEntry
  | LegacyApiRequestLogEntry
  | LegacyUiActivityLogEntry
  | LoginLogEntry

/** A new string with its parameters. */
export interface Message {
  key: string
  params?: Record<string, unknown>
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type LogCell =
  | { kind: 'time'; value: string }
  | { kind: 'text'; value: string | null; fallback?: Message }
  | { kind: 'multiline'; value: string | null; fallback?: Message }
  | { kind: 'code'; value: string | null; fallback?: Message }
  | { kind: 'list'; values: readonly string[] }
  | { kind: 'priority'; value: string; severity: LogSeverity | null }
  | { kind: 'trend'; value: number | null }
  | { kind: 'badge'; value: string | Message; tone: BadgeTone }
  | { kind: 'stripe'; hash: string | null }
  | { kind: 'reset'; hash: string | null }

export interface LogColumn {
  key: string
  label: TextRef
  /** Shown in the entry's details in the table (legacy hides it there too). */
  detail?: boolean
  cell(entry: LogEntry): LogCell
}

export interface LogTypeDescriptor {
  slug: LogSlug
  path: `/logs/${LogSlug}`
  operationId: string
  group: 'inMemory' | 'stored'
  retentionKey: keyof MonitoringCapabilities['logRetention']
  titleKey: string
  columns: readonly LogColumn[]
  /** The columns of a card's first line, and of its main text. */
  card: { head: readonly string[]; body: string }
}

const text = (value: string | null, fallback?: Message): LogCell => ({
  kind: 'text',
  value,
  fallback,
})
const UNKNOWN: Message = { key: 'operations.logs.unknown' }
const NONE: Message = { key: 'operations.logs.none' }

function column<E extends LogEntry>(
  key: string,
  label: TextRef,
  cell: (entry: E) => LogCell,
  detail = false,
): LogColumn {
  return { key, label, detail, cell: cell }
}

const time = column<LogEntry>('time', legacy('admin.time'), (entry) => ({
  kind: 'time',
  value: entry.time,
}))
const priority = column<SyslogLogEntry | NetfilterLogEntry | CronLogEntry>(
  'priority',
  legacy('admin.priority'),
  (entry) => ({ kind: 'priority', value: entry.priority, severity: entry.severity }),
)
const message = column<SyslogLogEntry | NetfilterLogEntry | AcmeLogEntry | CronLogEntry>(
  'message',
  legacy('admin.message'),
  (entry) => ({ kind: 'multiline', value: entry.message }),
)
const ip = (detail = false) =>
  column<
    | AutodiscoverLogEntry
    | RateLimitLogEntry
    | LegacyApiRequestLogEntry
    | LegacyUiActivityLogEntry
    | LoginLogEntry
  >('ip', 'operations.logs.columns.ip', (entry) => text(entry.clientAddress), detail)

const syslog = [time, priority, message]
const SYSLOG_CARD = { head: ['time', 'priority'], body: 'message' }

/** The tone of a legacy badge class (`bg-success`, `bg-danger`, …) named by a value. */
function classTone(value: string): BadgeTone {
  return value === 'success' || value === 'warning' || value === 'danger' || value === 'info'
    ? value
    : 'neutral'
}

function autodiscoverService(service: string): LogCell {
  if (service === 'activesync') {
    return {
      kind: 'badge',
      value: { key: 'operations.logs.autodiscover.activesync' },
      tone: 'info',
    }
  }
  if (service === 'imap') {
    return { kind: 'badge', value: { key: 'operations.logs.autodiscover.imap' }, tone: 'success' }
  }
  return { kind: 'badge', value: service, tone: 'danger' }
}

function watchdogMessage(entry: WatchdogLogEntry): LogCell {
  if (entry.message !== null) return { kind: 'multiline', value: entry.message }
  return {
    kind: 'text',
    value: null,
    fallback: {
      key: 'operations.logs.healthLevel',
      params: {
        level: entry.healthLevelPercent ?? '',
        now: entry.healthPointsNow ?? '',
        total: entry.healthPointsTotal ?? '',
      },
    },
  }
}

function uiMessage(entry: LegacyUiActivityLogEntry): LogCell {
  const parameters =
    entry.messageParameters.length > 0 ? JSON.stringify(entry.messageParameters) : ''
  const value = [entry.messageKey ?? '', parameters].filter((part) => part !== '').join(' ')
  return { kind: 'multiline', value }
}

const json = (value: unknown): LogCell => ({
  kind: 'multiline',
  value: value === null || value === undefined ? null : JSON.stringify(value, null, 2),
})

export const LOG_TYPES: readonly LogTypeDescriptor[] = [
  {
    slug: 'postfix',
    path: '/logs/postfix',
    operationId: 'listPostfixLog',
    group: 'inMemory',
    retentionKey: 'postfix',
    titleKey: 'operations.logs.types.postfix',
    columns: syslog,
    card: SYSLOG_CARD,
  },
  {
    slug: 'dovecot',
    path: '/logs/dovecot',
    operationId: 'listDovecotLog',
    group: 'inMemory',
    retentionKey: 'dovecot',
    titleKey: 'operations.logs.types.dovecot',
    columns: syslog,
    card: SYSLOG_CARD,
  },
  {
    slug: 'sogo',
    path: '/logs/sogo',
    operationId: 'listSogoLog',
    group: 'inMemory',
    retentionKey: 'sogo',
    titleKey: 'operations.logs.types.sogo',
    columns: syslog,
    card: SYSLOG_CARD,
  },
  {
    slug: 'netfilter',
    path: '/logs/netfilter',
    operationId: 'listNetfilterLog',
    group: 'inMemory',
    retentionKey: 'netfilter',
    titleKey: 'operations.logs.types.netfilter',
    columns: syslog,
    card: SYSLOG_CARD,
  },
  {
    slug: 'autodiscover',
    path: '/logs/autodiscover',
    operationId: 'listAutodiscoverLog',
    group: 'inMemory',
    retentionKey: 'autodiscover',
    titleKey: 'operations.logs.types.autodiscover',
    columns: [
      time,
      column<AutodiscoverLogEntry>('userAgent', 'operations.logs.columns.userAgent', (entry) =>
        text(entry.userAgent, UNKNOWN),
      ),
      column<AutodiscoverLogEntry>('user', legacy('admin.username'), (entry) =>
        text(entry.user, UNKNOWN),
      ),
      ip(),
      column<AutodiscoverLogEntry>('service', legacy('admin.service'), (entry) =>
        autodiscoverService(entry.service),
      ),
    ],
    card: { head: ['time', 'service'], body: 'user' },
  },
  {
    slug: 'watchdog',
    path: '/logs/watchdog',
    operationId: 'listWatchdogLog',
    group: 'inMemory',
    retentionKey: 'watchdog',
    titleKey: 'operations.logs.types.watchdog',
    columns: [
      time,
      column<WatchdogLogEntry>('service', legacy('admin.service'), (entry) => text(entry.service)),
      column<WatchdogLogEntry>('trend', 'operations.logs.columns.trend', (entry) => ({
        kind: 'trend',
        value: entry.message === null ? entry.healthPointsChange : null,
      })),
      column<WatchdogLogEntry>('message', legacy('admin.message'), watchdogMessage),
    ],
    card: { head: ['time', 'service', 'trend'], body: 'message' },
  },
  {
    slug: 'acme',
    path: '/logs/acme',
    operationId: 'listAcmeLog',
    group: 'inMemory',
    retentionKey: 'acme',
    titleKey: 'operations.logs.types.acme',
    columns: [time, message],
    card: { head: ['time'], body: 'message' },
  },
  {
    slug: 'legacy-api-requests',
    path: '/logs/legacy-api-requests',
    operationId: 'listLegacyApiRequestLog',
    group: 'inMemory',
    retentionKey: 'legacyApiRequests',
    titleKey: 'operations.logs.types.api',
    columns: [
      time,
      column<LegacyApiRequestLogEntry>('uri', 'operations.logs.columns.uri', (entry) =>
        text(entry.uri),
      ),
      column<LegacyApiRequestLogEntry>('method', 'operations.logs.columns.method', (entry) => ({
        kind: 'badge',
        value: entry.method,
        tone: entry.method === 'GET' ? 'success' : entry.method === 'POST' ? 'warning' : 'neutral',
      })),
      ip(),
      column<LegacyApiRequestLogEntry>(
        'data',
        'operations.logs.columns.data',
        (entry) => json(entry.requestData),
        true,
      ),
    ],
    card: { head: ['time', 'method'], body: 'uri' },
  },
  {
    slug: 'rate-limits',
    path: '/logs/rate-limits',
    operationId: 'listRateLimitLog',
    group: 'inMemory',
    retentionKey: 'rateLimits',
    titleKey: 'operations.logs.types.ratelimits',
    columns: [
      column<RateLimitLogEntry>('stripe', 'operations.logs.columns.hash', (entry) => ({
        kind: 'stripe',
        hash: entry.rateLimitHash,
      })),
      time,
      column<RateLimitLogEntry>('rateLimitName', legacy('admin.rate_name'), (entry) =>
        text(entry.rateLimitName),
      ),
      column<RateLimitLogEntry>('sender', legacy('admin.sender'), (entry) => text(entry.sender)),
      column<RateLimitLogEntry>('recipients', legacy('admin.recipients'), (entry) => ({
        kind: 'list',
        values: entry.recipients,
      })),
      column<RateLimitLogEntry>('user', legacy('admin.authed_user'), (entry) =>
        text(entry.user, NONE),
      ),
      column<RateLimitLogEntry>(
        'messageId',
        'operations.logs.columns.messageId',
        (entry) => text(entry.messageId),
        true,
      ),
      column<RateLimitLogEntry>(
        'headerFrom',
        'operations.logs.columns.headerFrom',
        (entry) => text(entry.headerFrom),
        true,
      ),
      column<RateLimitLogEntry>(
        'subject',
        legacy('admin.subject'),
        (entry) => text(entry.subject),
        true,
      ),
      column<RateLimitLogEntry>(
        'hash',
        'operations.logs.columns.hash',
        (entry) => ({
          kind: 'code',
          value: entry.rateLimitHash,
          fallback: { key: 'operations.logs.noHash' },
        }),
        true,
      ),
      column<RateLimitLogEntry>(
        'scannerQueueId',
        legacy('quarantine.qid'),
        (entry) => text(entry.scannerQueueId),
        true,
      ),
      ip(true),
      column<RateLimitLogEntry>('action', legacy('admin.action'), (entry) => ({
        kind: 'reset',
        hash: entry.rateLimitHash,
      })),
    ],
    card: { head: ['time', 'rateLimitName'], body: 'sender' },
  },
  {
    slug: 'cron',
    path: '/logs/cron',
    operationId: 'listCronLog',
    group: 'inMemory',
    retentionKey: 'cron',
    titleKey: 'operations.logs.types.crontasks',
    columns: [
      time,
      column<CronLogEntry>('task', legacy('admin.task'), (entry) => text(entry.task)),
      priority,
      message,
    ],
    card: { head: ['time', 'priority', 'task'], body: 'message' },
  },
  {
    slug: 'legacy-ui-activity',
    path: '/logs/legacy-ui-activity',
    operationId: 'listLegacyUiActivityLog',
    group: 'stored',
    retentionKey: 'legacyUiActivity',
    titleKey: 'operations.logs.types.ui',
    columns: [
      time,
      column<LegacyUiActivityLogEntry>(
        'type',
        legacy('admin.ui_header_announcement_type'),
        (entry) => ({ kind: 'badge', value: entry.type, tone: classTone(entry.type) }),
      ),
      column<LegacyUiActivityLogEntry>('task', legacy('admin.task'), (entry) => ({
        kind: 'code',
        value: entry.task,
      })),
      column<LegacyUiActivityLogEntry>('user', 'operations.logs.columns.user', (entry) =>
        text(entry.user),
      ),
      column<LegacyUiActivityLogEntry>('role', 'operations.logs.columns.role', (entry) =>
        text(entry.role),
      ),
      ip(),
      column<LegacyUiActivityLogEntry>('message', legacy('admin.message'), uiMessage),
      column<LegacyUiActivityLogEntry>(
        'call',
        'operations.logs.columns.call',
        (entry) => json(entry.call),
        true,
      ),
    ],
    card: { head: ['time', 'type'], body: 'message' },
  },
  {
    slug: 'logins',
    path: '/logs/logins',
    operationId: 'listLoginLog',
    group: 'stored',
    retentionKey: 'logins',
    titleKey: 'operations.logs.types.sasl',
    columns: [
      column<LoginLogEntry>('username', legacy('admin.username'), (entry) => text(entry.username)),
      column<LoginLogEntry>('service', legacy('admin.service'), (entry) => ({
        kind: 'badge',
        value: entry.service,
        tone: 'neutral',
      })),
      ip(),
      column<LoginLogEntry>('time', legacy('admin.login_time'), (entry) => ({
        kind: 'time',
        value: entry.time,
      })),
    ],
    card: { head: ['time', 'service'], body: 'username' },
  },
]

export function findLogType(slug: string | null | undefined): LogTypeDescriptor | undefined {
  return LOG_TYPES.find((type) => type.slug === slug)
}
