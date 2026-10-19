// State of the operations scenarios (UI 011 T013, research R21): the monitoring capabilities, the
// host clock, per-kind collection lags, failure injection by operationId, and one data slot per
// area module (`dashboard.ts`, `container-actions.ts`, `logs.ts`, `mail-queue.ts`, `fail2ban.ts`,
// `rspamd.ts`, `updates.ts`). Each area module owns its data type and its patch type, so parallel
// stories never edit this file.
import type { MonitoringCapabilities } from '@/api'

import type { ScenarioState } from '../state'
import type { ContainerActionsData, ContainerActionsPatch } from './container-actions'
import type { DashboardData, DashboardPatch } from './dashboard'
import type { Fail2banData, Fail2banPatch } from './fail2ban'
import type { LogsData, LogsPatch } from './logs'
import type { MailQueueData, MailQueuePatch } from './mail-queue'
import type { RspamdData, RspamdPatch } from './rspamd'
import type { UpdatesData, UpdatesPatch } from './updates'

/** Kinds of live data whose `collectedAt` (or `sampledAt`) can lag behind the host clock. */
export type LagKind = 'host' | 'containers' | 'resourceUsage' | 'mailStorage'

/**
 * An injection for one operation. With `status`, the operation answers that problem; without it,
 * the operation answers normally. `auditRecorded: false` adds `Audit-Recorded: false` to the
 * answer, `delayMs` delays it, and `times` limits how often the injection applies (default:
 * always).
 */
export interface OperationInjection {
  status?: number
  /** Problem type name (`/api/v2/problems/<name>`); `about:blank` when omitted. */
  problemType?: string
  /** Extension members of the problem (`container`, `serviceMessage`, `step`, …). */
  extensions?: Record<string, unknown>
  /** Field violations of a `422 validation-failed`. */
  errors?: Record<string, { code: string; message: string; params?: Record<string, unknown> }[]>
  retryAfter?: number
  auditRecorded?: false
  delayMs?: number
  times?: number
}

export interface OperationsState {
  capabilities: MonitoringCapabilities
  /** The host clock is the mock's clock plus this offset (`advanceHostClockSeconds`). */
  hostClockOffsetMs: number
  /** Seconds by which each kind's collection time lags behind the host clock. */
  lags: Partial<Record<LagKind, number>>
  inject: Record<string, OperationInjection>
  dashboard: DashboardData
  containerActions: ContainerActionsData
  logs: LogsData
  mailQueue: MailQueueData
  fail2ban: Fail2banData
  rspamd: RspamdData
  updates: UpdatesData
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** JSON changes through scenario overrides and `PATCH /__mock/scenarios/:id` (`operations`). */
export interface OperationsPatch {
  /** Moves the host clock forward (seconds); page.clock cannot reach the mock. */
  advanceHostClockSeconds?: number
  capabilities?: DeepPartial<MonitoringCapabilities>
  lags?: Partial<Record<LagKind, number>>
  /** Adds injections by operationId; `null` removes one. */
  inject?: Record<string, OperationInjection | null>
  dashboard?: DashboardPatch
  containerActions?: ContainerActionsPatch
  logs?: LogsPatch
  mailQueue?: MailQueuePatch
  fail2ban?: Fail2banPatch
  rspamd?: RspamdPatch
  updates?: UpdatesPatch
}

const IN_MEMORY = { policy: 'entries', maxEntries: 10_000 } as const

/** The contract's documented defaults (API 011 FR-069). */
export function defaultMonitoringCapabilities(): MonitoringCapabilities {
  return {
    ipCheckEnabled: true,
    pollIntervalSeconds: 5,
    maxAgeSeconds: {
      containerStates: 5,
      hostStatistics: 10,
      containerResourceUsage: 15,
      mailStorage: 60,
    },
    logRetention: {
      postfix: { ...IN_MEMORY },
      dovecot: { ...IN_MEMORY },
      sogo: { ...IN_MEMORY },
      netfilter: { ...IN_MEMORY },
      autodiscover: { policy: 'entries', maxEntries: 101 },
      watchdog: { ...IN_MEMORY },
      acme: { ...IN_MEMORY },
      cron: { ...IN_MEMORY },
      rateLimits: { ...IN_MEMORY },
      legacyApiRequests: { ...IN_MEMORY },
      legacyUiActivity: { policy: 'unbounded', maxEntries: null },
      logins: { policy: 'cleanedDaily', maxEntries: null },
    },
    clientAddress: '198.51.100.7',
    limits: {
      defaultPageSize: 25,
      maxPageSize: 1_000,
      mailQueueBulkMaxIds: 1_000,
      mailQueueListingMax: 10_000,
      fail2banRulesMax: 100,
      fail2banRuleMaxLength: 1_000,
      fail2banListMaxEntries: 10_000,
    },
  }
}

/** The host's current time in epoch ms. */
export function hostNow(state: ScenarioState): number {
  return state.now() + state.operations.hostClockOffsetMs
}

/** A collection time of a kind: the host clock minus the kind's lag, as RFC 3339. */
export function collectedAt(state: ScenarioState, kind: LagKind): string {
  return new Date(hostNow(state) - (state.operations.lags[kind] ?? 0) * 1000).toISOString()
}

export function mergeDeep<T>(base: T, change: DeepPartial<T> | undefined): T {
  if (!change) return base
  const result = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(change)) {
    const current = result[key]
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current
        ? mergeDeep(current, value as DeepPartial<typeof current>)
        : value
  }
  return result as T
}
