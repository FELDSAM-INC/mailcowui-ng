// The quarantine list's address parameters (UI 006 data-model §6, research R12, FR-009 to FR-015):
// search, filters, sort, page and size live in the address and map to `listQuarantineItems`;
// defaults are left out and invalid values dropped (`useListState`). The arrival range is kept as
// days (`YYYY-MM-DD`) and sent as instants of the device time zone, `to` as the start of the day
// after the last one (the API's `to` is exclusive). Scores are kept with `.` and one decimal. A
// mailbox user's `recipient` and `domain` are ignored (`scoped: false`); an inverted range is not
// sent. Changes return to the first page and call `onReset` (the bulk selection).
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  componentsParametersQuarantineItemSortValues,
  quarantineItemActionValues,
  type QuarantineItemAction,
  type QuarantineListParams,
} from '@/api'
import {
  custom,
  manyOf,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
  type SortOrder,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type QuarantineSort = (typeof componentsParametersQuarantineItemSortValues)[number]
export type BooleanParam = 'true' | 'false'

/** The longest recipient address and domain name the API accepts as a filter. */
export const RECIPIENT_FILTER_MAX_LENGTH = 255

export interface QuarantineListFilters extends Record<string, unknown> {
  q: string | undefined
  recipient: string | undefined
  domain: string | undefined
  action: QuarantineItemAction[]
  virus: BooleanParam | undefined
  notified: BooleanParam | undefined
  /** First day, `YYYY-MM-DD`, included. */
  from: string | undefined
  /** Last day, `YYYY-MM-DD`, included. */
  to: string | undefined
  /** Decimal with `.` and at most one fraction digit. */
  minScore: string | undefined
  maxScore: string | undefined
}

export const NO_FILTERS: QuarantineListFilters = {
  q: undefined,
  recipient: undefined,
  domain: undefined,
  action: [],
  virus: undefined,
  notified: undefined,
  from: undefined,
  to: undefined,
  minScore: undefined,
  maxScore: undefined,
}

const DESCENDING_BY_DEFAULT: ReadonlySet<QuarantineSort> = new Set(['arrivedAt', 'id', 'score'])

export const defaultOrder = (sort: QuarantineSort): SortOrder =>
  DESCENDING_BY_DEFAULT.has(sort) ? 'desc' : 'asc'

/** An address with one `@`, a local part and a domain part, and no white space. */
export const RECIPIENT_PATTERN = /^[^\s@]+@[^\s@]+$/

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const SCORE = /^\d{1,7}(?:\.\d)?$/

/** A calendar day that exists, as `[year, monthIndex, day]`. */
function dayParts(value: string): [number, number, number] | null {
  const match = DAY.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? [year, month, day]
    : null
}

const pattern = (test: (value: string) => boolean) =>
  custom<string | undefined>({
    parse(raw) {
      const value = (Array.isArray(raw) ? raw[0] : raw)?.trim()
      return typeof value === 'string' && value !== '' && test(value) ? value : undefined
    },
    serialize: (value) => value,
    isSet: (value) => !!value,
  })

export const quarantineListSchema: ListSchema<QuarantineListFilters, QuarantineSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    recipient: pattern(
      (value) => value.length <= RECIPIENT_FILTER_MAX_LENGTH && RECIPIENT_PATTERN.test(value),
    ),
    domain: text({ maxLength: RECIPIENT_FILTER_MAX_LENGTH }),
    action: manyOf(quarantineItemActionValues, { max: quarantineItemActionValues.length }),
    virus: oneOf(['true', 'false'] as const),
    notified: oneOf(['true', 'false'] as const),
    from: pattern((value) => dayParts(value) !== null),
    to: pattern((value) => dayParts(value) !== null),
    minScore: pattern((value) => SCORE.test(value)),
    maxScore: pattern((value) => SCORE.test(value)),
  },
  sort: {
    values: componentsParametersQuarantineItemSortValues,
    default: 'arrivedAt',
    defaultOrder,
  },
}

/** The start of a day in the device time zone, `offset` days later, as an RFC 3339 instant. */
export function dayToInstant(day: string, offset: number): string {
  const [year, month, date] = dayParts(day) ?? [1970, 0, 1]
  return new Date(year, month, date + offset).toISOString()
}

export const dayRangeInverted = (filters: Pick<QuarantineListFilters, 'from' | 'to'>) =>
  !!filters.from && !!filters.to && filters.from > filters.to

export const scoreToTenths = (value: string | undefined): number | null =>
  value === undefined ? null : Math.round(Number(value) * 10)

export const scoreFromTenths = (tenths: number | null): string | undefined =>
  tenths === null ? undefined : String(tenths / 10)

export const scoreRangeInverted = (filters: Pick<QuarantineListFilters, 'minScore' | 'maxScore'>) =>
  filters.minScore !== undefined &&
  filters.maxScore !== undefined &&
  Number(filters.minScore) > Number(filters.maxScore)

/** Whether the caller sees other mailboxes' items (administrators and domain administrators). */
export interface ScopeOptions {
  scoped: boolean
}

/** The `listQuarantineItems` query of a list state; unset and ignored filters are left out. */
export function toListParams(
  state: ListState<QuarantineListFilters, QuarantineSort>,
  options: ScopeOptions,
): QuarantineListParams {
  const { filters, page, size } = state
  const sort = state.sort ?? 'arrivedAt'
  const days = !dayRangeInverted(filters)
  const scores = !scoreRangeInverted(filters)
  return {
    limit: size,
    offset: (page - 1) * size,
    sort,
    order: state.order ?? defaultOrder(sort),
    ...(filters.q ? { q: filters.q } : {}),
    ...(options.scoped && filters.recipient ? { recipient: filters.recipient } : {}),
    ...(options.scoped && filters.domain ? { domain: filters.domain } : {}),
    ...(filters.action.length > 0 ? { action: [...filters.action] } : {}),
    ...(filters.virus ? { virus: filters.virus === 'true' } : {}),
    ...(filters.notified ? { notified: filters.notified === 'true' } : {}),
    ...(days && filters.from ? { from: dayToInstant(filters.from, 0) } : {}),
    ...(days && filters.to ? { to: dayToInstant(filters.to, 1) } : {}),
    ...(scores && filters.minScore !== undefined ? { minScore: Number(filters.minScore) } : {}),
    ...(scores && filters.maxScore !== undefined ? { maxScore: Number(filters.maxScore) } : {}),
  }
}

/** Filters other than the search, each value counted once; ignored filters are not counted. */
export function activeFilterCount(filters: QuarantineListFilters, scoped: boolean): number {
  const set = (value: unknown) => (value === undefined ? 0 : 1)
  return (
    filters.action.length +
    set(filters.virus) +
    set(filters.notified) +
    set(filters.from) +
    set(filters.to) +
    set(filters.minScore) +
    set(filters.maxScore) +
    (scoped ? set(filters.recipient) + set(filters.domain) : 0)
  )
}

export function useQuarantineListState(
  options: ListStateOptions & { scoped: MaybeRefOrGetter<boolean> },
) {
  const list = useListState(quarantineListSchema, options)
  const scoped = computed(() => toValue(options.scoped))
  const count = computed(() => activeFilterCount(list.state.value.filters, scoped.value))
  return {
    ...list,
    params: computed(() => toListParams(list.state.value, { scoped: scoped.value })),
    activeFilterCount: count,
    /** The search or any filter that applies is set. */
    hasSearchOrFilters: computed(() => !!list.state.value.filters.q || count.value > 0),
  }
}
