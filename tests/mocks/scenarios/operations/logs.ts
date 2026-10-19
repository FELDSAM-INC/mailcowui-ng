// Logs area of the operations scenarios (UI 011 T013, T071): the entries of the 12 log types
// (newest first), entries pushed on every list request (arrivals while older entries load), the
// rate limit buckets already reset, and the scenarios of US3.
import {
  logEntries,
  logEntry,
  LOG_SLUGS,
  type LogEntryOf,
  type LogSlug,
} from '../../factories/log-entry'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export type LogEntries = { [S in LogSlug]: LogEntryOf[S][] }

export interface LogsData {
  /** Time of sequence 0 of every log type (epoch milliseconds). */
  base: number
  /** Entries of each type, newest first. */
  entries: LogEntries
  /** The next sequence number of each type. */
  next: Record<LogSlug, number>
  /** Entries added to a type before each of its list requests. */
  pushPerRequest: Partial<Record<LogSlug, number>>
  /** Rate limit buckets reset so far (a second reset answers 404). */
  resetBuckets: string[]
}

export interface LogsPatch {
  /** Adds new entries to these types now. */
  push?: Partial<Record<LogSlug, number>>
  pushPerRequest?: Partial<Record<LogSlug, number>>
}

const emptyEntries = (): LogEntries =>
  Object.fromEntries(LOG_SLUGS.map((slug) => [slug, []])) as unknown as LogEntries

export function initialLogsData(): LogsData {
  return {
    base: 0,
    entries: emptyEntries(),
    next: Object.fromEntries(LOG_SLUGS.map((slug) => [slug, 0])) as Record<LogSlug, number>,
    pushPerRequest: {},
    resetBuckets: [],
  }
}

/** Replaces a type's entries with `count` generated entries, the newest ten minutes ago. */
export function fillLog(state: ScenarioState, slug: LogSlug, count: number): void {
  const logs = state.operations.logs
  const newest = state.now() - 600_000
  logs.base = newest - (count - 1) * 1000
  ;(logs.entries[slug] as LogEntryOf[LogSlug][]) = logEntries(slug, count, newest)
  logs.next[slug] = count
}

/** Adds `count` new entries (newer than every entry) to a type. */
export function pushLogEntries(state: ScenarioState, slug: LogSlug, count: number): void {
  const logs = state.operations.logs
  const entries = logs.entries[slug] as LogEntryOf[LogSlug][]
  const base =
    entries.length > 0 ? Date.parse(entries[0]!.time) - (logs.next[slug] - 1) * 1000 : logs.base
  for (let i = 0; i < count; i += 1) {
    const sequence = logs.next[slug]
    logs.next[slug] = sequence + 1
    entries.unshift(logEntry(slug, sequence, base))
  }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.logs`). */
export function applyLogsPatch(state: ScenarioState, patch: LogsPatch): void {
  for (const [slug, count] of Object.entries(patch.push ?? {})) {
    pushLogEntries(state, slug as LogSlug, count ?? 0)
  }
  if (patch.pushPerRequest) {
    state.operations.logs.pushPerRequest = {
      ...state.operations.logs.pushPerRequest,
      ...patch.pushPerRequest,
    }
  }
}

/** The healthy installation: 120 entries of every log type. */
export function seedLogs(state: ScenarioState): void {
  for (const slug of LOG_SLUGS) fillLog(state, slug, 120)
}

const unavailable = { status: 503, problemType: 'temporary-failure', retryAfter: 30 }

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const logsScenarios: Record<string, ScenarioDefinition> = {
  'ops-logs-large': {
    description:
      'An administrator with 10,000 Postfix entries; three new entries arrive before every Postfix request (UI 011 US3-AS1, SC-010).',
    setup(state) {
      fillLog(state, 'postfix', 10_000)
      state.operations.logs.pushPerRequest = { postfix: 3 }
    },
  },
  'ops-logs-empty': {
    description: 'An administrator whose logs are all empty (UI 011 FR-043).',
    setup(state) {
      state.operations.logs.entries = emptyEntries()
    },
  },
  'ops-logs-unavailable': {
    description: 'The Postfix and Dovecot logs answer 503 temporary-failure (UI 011 US3-AS8).',
    setup(state) {
      state.operations.inject.listPostfixLog = { ...unavailable }
      state.operations.inject.listDovecotLog = { ...unavailable }
    },
  },
  'ops-rate-limits': {
    description:
      'Rate limit entries of three buckets, some without or with a malformed hash; each bucket resets once (UI 011 US3-AS9).',
    setup(state) {
      fillLog(state, 'rate-limits', 40)
    },
  },
}
