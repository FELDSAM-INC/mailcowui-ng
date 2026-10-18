// The sync-job list's address (UI 008 research R6, data-model §5, FR-009 to FR-012). Search,
// filters, sort, page and size live in the address; the open log (`log`) is a view parameter that
// never resets the page or the selection. Newest job first by default, as the classic table sorts.
// Mailbox users get no mailbox or domain filter and no mailbox sort.
import { computed } from 'vue'

import type { Role, SyncJobListParams } from '@/api'
import {
  custom,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export const SYNC_JOB_SORTS = [
  'id',
  'mailbox',
  'remoteHost',
  'remoteUser',
  'intervalMinutes',
  'active',
  'lastRunAt',
  'lastResult',
] as const
export type SyncJobSort = (typeof SYNC_JOB_SORTS)[number]

export const RESULT_FILTERS = ['succeeded', 'failed', 'none'] as const

export interface SyncJobListFilters extends Record<string, unknown> {
  q: string | undefined
  mailbox: string | undefined
  domain: string | undefined
  active: 'yes' | 'no' | undefined
  running: 'yes' | 'no' | undefined
  result: (typeof RESULT_FILTERS)[number] | undefined
}

export interface SyncJobListViews extends Record<string, unknown> {
  log: number | undefined
}

/** The largest job identifier of the contract (`SyncJobId`). */
export const MAX_SYNC_JOB_ID = 2_147_483_647

/** A job identifier, or undefined. */
export function parseJobId(raw: unknown): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value)) return undefined
  const id = Number(value)
  return id <= MAX_SYNC_JOB_ID ? id : undefined
}

const jobId = custom<number | undefined>({
  parse: parseJobId,
  serialize: (value) => (value === undefined ? undefined : String(value)),
  isSet: (value) => value !== undefined,
})

const ADDRESS_MAX_LENGTH = 255

/** Filters that only make sense for an empty value in the mailbox user's list. */
const never = custom<string | undefined>({
  parse: () => undefined,
  serialize: () => undefined,
  isSet: () => false,
})

export function syncJobListSchema(
  role: Role,
): ListSchema<SyncJobListFilters, SyncJobSort, SyncJobListViews> {
  const manager = role !== 'mailboxUser'
  return {
    filters: {
      q: text({ maxLength: SEARCH_MAX_LENGTH }),
      mailbox: manager ? text({ maxLength: ADDRESS_MAX_LENGTH }) : never,
      domain: manager ? text({ maxLength: ADDRESS_MAX_LENGTH }) : never,
      active: oneOf(['yes', 'no'] as const),
      running: oneOf(['yes', 'no'] as const),
      result: oneOf(RESULT_FILTERS),
    },
    sort: {
      values: manager ? SYNC_JOB_SORTS : SYNC_JOB_SORTS.filter((sort) => sort !== 'mailbox'),
      default: 'id',
      defaultOrder: (sort) => (sort === 'id' ? 'desc' : 'asc'),
    },
    views: { log: jobId },
  }
}

const yesNo = (value: 'yes' | 'no' | undefined) =>
  value === undefined ? undefined : value === 'yes'

/** The `listSyncJobs` query of a list state; unset filters are left out. */
export function toListParams(state: ListState<SyncJobListFilters, SyncJobSort>): SyncJobListParams {
  const { filters, page, size } = state
  const active = yesNo(filters.active)
  const running = yesNo(filters.running)
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.mailbox ? { mailbox: filters.mailbox } : {}),
    ...(filters.domain ? { domain: filters.domain } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(running !== undefined ? { running } : {}),
    ...(filters.result
      ? { lastResult: filters.result === 'none' ? 'unknown' : filters.result }
      : {}),
    sort: state.sort ?? 'id',
    order: state.order ?? 'desc',
    limit: size,
    offset: (page - 1) * size,
  }
}

export function useSyncJobListState(role: Role, options: ListStateOptions = {}) {
  const list = useListState(syncJobListSchema(role), options)
  return {
    ...list,
    params: computed(() => toListParams(list.state.value)),
    /** Filters other than the search. */
    activeFilterCount: computed(() => list.activeFilters.value.filter((key) => key !== 'q').length),
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
