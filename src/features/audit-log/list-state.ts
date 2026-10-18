// The audit log's address parameters (data-model §5, conventions "Lists"): time range, event types
// (repeatable), outcome, actor and client address, plus page and size. The sort is always
// `occurredAt` newest first, so it is not in the address.
//
// The target filters (UI 002 US8, FR-063): the History action of an object opens
// `/audit-log?targetType=<type>&targetId=<id>`; both are sent as `targetType` and `targetId`.
import {
  auditEventTypeValues,
  auditOutcomeValues,
  auditTargetTypeValues,
  type AuditEventType,
  type AuditListParams,
  type AuditOutcome,
} from '@/api'
import {
  custom,
  manyOf,
  oneOf,
  text,
  type ListSchema,
  type ListState,
  type ParamSpec,
} from '@/shared/composables/useListState'
import { isIpNetwork } from '@/shared/validation/ip-network'
import {
  AUDIT_ACTOR_MAX_LENGTH,
  AUDIT_ADDRESS_MAX_LENGTH,
  AUDIT_EVENT_TYPES_MAX_ITEMS,
  AUDIT_TARGET_ID_MAX_LENGTH,
} from '@/shared/validation/limits'

import { AUDIT_RANGES, resolveRange, type AuditRange } from './time-range'

export type AuditFilterValues = {
  range: AuditRange | undefined
  /** RFC 3339; used with `range=custom` only. */
  from: string | undefined
  to: string | undefined
  event: AuditEventType[]
  outcome: AuditOutcome | undefined
  actor: string | undefined
  address: string | undefined
  targetType: (typeof auditTargetTypeValues)[number] | undefined
  targetId: string | undefined
}

export const AUDIT_FILTER_KEYS = [
  'range',
  'event',
  'outcome',
  'actor',
  'address',
  'targetType',
  'targetId',
] as const

const first = (raw: unknown): string | undefined => {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : undefined
}

/** An RFC 3339 time, normalised to UTC with milliseconds. */
const time: ParamSpec<string | undefined> = {
  parse(raw) {
    const value = first(raw)
    if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString()
  },
  serialize: (value) => value,
  isSet: (value) => value !== undefined,
}

/** An IPv4 or IPv6 address or prefix of at most 49 characters. */
const network: ParamSpec<string | undefined> = {
  parse(raw) {
    const value = first(raw)?.trim()
    return value && value.length <= AUDIT_ADDRESS_MAX_LENGTH && isIpNetwork(value)
      ? value
      : undefined
  },
  serialize: (value) => value,
  isSet: (value) => value !== undefined,
}

export const auditListSchema: ListSchema<AuditFilterValues> = {
  filters: {
    range: oneOf(AUDIT_RANGES),
    from: custom(time),
    to: custom(time),
    event: manyOf(auditEventTypeValues, { max: AUDIT_EVENT_TYPES_MAX_ITEMS }),
    outcome: oneOf(auditOutcomeValues),
    actor: text({ maxLength: AUDIT_ACTOR_MAX_LENGTH }),
    address: custom(network),
    targetType: oneOf(auditTargetTypeValues),
    targetId: text({ maxLength: AUDIT_TARGET_ID_MAX_LENGTH }),
  },
}

/** The request parameters of a list state; presets are resolved against `now`. */
export function toAuditParams(
  state: ListState<AuditFilterValues, never>,
  now: number = Date.now(),
): AuditListParams {
  const { filters } = state
  const params: AuditListParams = {
    limit: state.size,
    offset: (state.page - 1) * state.size,
    sort: 'occurredAt',
    order: 'desc',
    ...resolveRange(filters, now),
  }
  if (filters.event.length > 0) params.eventType = [...filters.event]
  if (filters.outcome) params.outcome = filters.outcome
  if (filters.actor) params.actor = filters.actor
  if (filters.address) params.clientAddress = filters.address
  if (filters.targetType) params.targetType = filters.targetType
  if (filters.targetId) params.targetId = filters.targetId
  return params
}
