// The audit log's address parameters (data-model §5, conventions "Lists"): time range, event types
// (repeatable), outcome, actor and client address, plus page and size. The sort is always
// `occurredAt` newest first, so it is not in the address.
//
// `targetType` and `targetId` are reserved (research R20, plan API gap 1): the History action of
// later features opens `/audit-log?targetType=<type>&targetId=<id>`. The pinned contract has no
// target filters on GET /audit-events, so the parameters stay in the address but are never sent;
// the contract bump that adds them maps them in `toAuditParams` below.
import {
  auditEventTypeValues,
  auditOutcomeValues,
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
} from '@/shared/validation/limits'

import { AUDIT_RANGES, resolveRange, type AuditRange } from './time-range'

export const RESERVED_TARGET_PARAMS = ['targetType', 'targetId'] as const

export type AuditFilterValues = {
  range: AuditRange | undefined
  /** RFC 3339; used with `range=custom` only. */
  from: string | undefined
  to: string | undefined
  event: AuditEventType[]
  outcome: AuditOutcome | undefined
  actor: string | undefined
  address: string | undefined
  /** Reserved: kept in the address, not sent (see above). */
  targetType: string | undefined
  targetId: string | undefined
}

/** The user-facing filters, without the reserved target parameters. */
export const AUDIT_FILTER_KEYS = ['range', 'event', 'outcome', 'actor', 'address'] as const

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
    targetType: text({ maxLength: 64 }),
    targetId: text({ maxLength: 255 }),
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
  // filters.targetType and filters.targetId: not in the pinned contract (see above).
  return params
}
