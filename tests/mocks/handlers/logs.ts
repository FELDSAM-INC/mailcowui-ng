// Log handlers (UI 011 T014, T070): the 12 log operations of API 011 on the scenario state. Entries
// arrive before a request when the scenario pushes them; the list is sorted by time (`order`),
// filtered by `from`/`to` (inclusive), `severity`, the type's filters (case-insensitive substrings,
// OR within one filter) and `q` (case-insensitive over the entry's texts), and paged with `limit`
// and `offset`. `before` keeps only the entries older than the cursor's entry, whatever the order;
// a cursor whose entry is gone yields an empty page, and a malformed one is refused (422
// `invalidFormat`, `format: logCursor`). `meta.total` counts the matching entries (the older ones
// with `before`).
import { CURSOR, type LogSlug, type MockLogEntry } from '../factories/log-entry'
import { pushLogEntries } from '../scenarios/operations/logs'
import type { ScenarioState } from '../scenarios/state'
import { http, problem } from './context'
import { operationGate } from './operations-context'

const TYPE_FILTERS: Record<LogSlug, string[]> = {
  postfix: ['priority', 'program'],
  dovecot: ['priority', 'program'],
  sogo: ['priority'],
  netfilter: ['priority'],
  autodiscover: ['service', 'user'],
  watchdog: ['service'],
  acme: [],
  cron: ['task', 'priority'],
  'rate-limits': ['rateLimitName', 'sender', 'user'],
  'legacy-api-requests': ['method', 'clientAddress'],
  'legacy-ui-activity': ['type', 'user', 'role'],
  logins: ['username', 'service', 'clientAddress'],
}

function texts(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(texts)
  if (typeof value === 'object') return [JSON.stringify(value)]
  return []
}

function searchable(entry: MockLogEntry): string {
  return Object.entries(entry)
    .filter(([key]) => key !== 'id' && key !== 'time')
    .flatMap(([, value]) => texts(value))
    .join('\n')
    .toLowerCase()
}

function invalidCursor(): Response {
  return problem(422, 'validation-failed', {
    errors: {
      before: [
        {
          code: 'invalidFormat',
          params: { format: 'logCursor' },
          message: 'The value is not a log cursor.',
        },
      ],
    },
  })
}

/** The answer of a log list request, or a problem. */
export function listLog(state: ScenarioState, slug: LogSlug, query: URLSearchParams): Response {
  const push = state.operations.logs.pushPerRequest[slug]
  if (push) pushLogEntries(state, slug, push)

  const before = query.get('before')
  if (before !== null && !CURSOR.test(before)) return invalidCursor()

  const all = state.operations.logs.entries[slug] as MockLogEntry[]
  let entries = all
  if (before !== null) {
    const at = all.findIndex((entry) => entry.id === before)
    entries = at < 0 ? [] : all.slice(at + 1)
  }

  const from = query.get('from')
  const to = query.get('to')
  const severities = query.getAll('severity')
  const q = query.get('q')?.trim().toLowerCase()
  const filters = TYPE_FILTERS[slug]
    .map((name) => [name, query.getAll(name).map((value) => value.toLowerCase())] as const)
    .filter(([, values]) => values.length > 0)

  const matching = entries.filter((entry) => {
    const time = Date.parse(entry.time)
    if (from && time < Date.parse(from)) return false
    if (to && time > Date.parse(to)) return false
    if (severities.length > 0) {
      const severity = 'severity' in entry ? entry.severity : null
      if (!severity || !severities.includes(severity)) return false
    }
    for (const [name, values] of filters) {
      const field = texts((entry as unknown as Record<string, unknown>)[name])
        .join('\n')
        .toLowerCase()
      if (!values.some((value) => field.includes(value))) return false
    }
    if (q && !searchable(entry).includes(q)) return false
    return true
  })

  const ordered = query.get('order') === 'asc' ? [...matching].reverse() : matching
  const limit = Number(query.get('limit') ?? 25)
  const offset = Number(query.get('offset') ?? 0)
  return Response.json({
    data: ordered.slice(offset, offset + limit),
    meta: { total: matching.length, limit, offset },
  })
}

const OPERATIONS: [LogSlug, string][] = [
  ['postfix', 'listPostfixLog'],
  ['dovecot', 'listDovecotLog'],
  ['sogo', 'listSogoLog'],
  ['netfilter', 'listNetfilterLog'],
  ['autodiscover', 'listAutodiscoverLog'],
  ['watchdog', 'listWatchdogLog'],
  ['acme', 'listAcmeLog'],
  ['cron', 'listCronLog'],
  ['rate-limits', 'listRateLimitLog'],
  ['legacy-api-requests', 'listLegacyApiRequestLog'],
  ['legacy-ui-activity', 'listLegacyUiActivityLog'],
  ['logins', 'listLoginLog'],
]

export const logHandlers = OPERATIONS.map(([slug, operationId]) =>
  http.get(`/logs/${slug}` as '/logs/postfix', async ({ request, response }) => {
    const gate = await operationGate(operationId)
    if (gate.stop) return response.untyped(gate.stop)
    return response.untyped(
      gate.finish(listLog(gate.state, slug, new URL(request.url).searchParams)),
    )
  }),
)
