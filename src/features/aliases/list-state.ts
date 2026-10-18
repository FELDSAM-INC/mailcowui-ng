// The alias list's address parameters (data-model §5, FR-006, FR-013, FR-014): search, filters,
// sort, page and size live in the address with the contract's query names; defaults are left out.
// The groupware filter and sort key count only while the capabilities say the groupware is enabled.
import { computed } from 'vue'

import {
  aliasDestinationTypeValues,
  aliasKindValues,
  componentsParametersAliasSortValues,
  type AliasListParams,
} from '@/api'
import {
  manyOf,
  manyText,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type AliasSort = (typeof componentsParametersAliasSortValues)[number]
type Flag = 'true' | 'false' | undefined
const FLAG = ['true', 'false'] as const

export interface AliasListFilters extends Record<string, unknown> {
  q: string | undefined
  domain: string[]
  primaryDomain: string[]
  kind: (typeof aliasKindValues)[number][]
  destinationType: (typeof aliasDestinationTypeValues)[number][]
  destination: string | undefined
  active: Flag
  senderAllowed: Flag
  groupwareVisible: Flag
  internal: Flag
}

export type AliasListState = ListState<AliasListFilters, AliasSort>

const DOMAIN_FILTER = { max: 100, maxLength: 253 }

export const aliasListSchema: ListSchema<AliasListFilters, AliasSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    domain: manyText(DOMAIN_FILTER),
    primaryDomain: manyText(DOMAIN_FILTER),
    kind: manyOf(aliasKindValues, { max: aliasKindValues.length }),
    destinationType: manyOf(aliasDestinationTypeValues, { max: aliasDestinationTypeValues.length }),
    destination: text({ maxLength: 255 }),
    active: oneOf(FLAG),
    senderAllowed: oneOf(FLAG),
    groupwareVisible: oneOf(FLAG),
    internal: oneOf(FLAG),
  },
  sort: {
    values: componentsParametersAliasSortValues,
    default: 'id',
    defaultOrder: (sort) => (sort === 'id' ? 'desc' : 'asc'),
  },
}

const flag = (value: Flag) => (value === undefined ? undefined : value === 'true')

/** The `listAliases` query of a list state; unset filters are left out. */
export function toAliasParams(
  state: AliasListState,
  options: { groupwareEnabled: boolean | undefined },
): AliasListParams {
  const { filters, page, size } = state
  const groupware = options.groupwareEnabled === true
  const sortable = state.sort && (state.sort !== 'groupwareVisible' || groupware)
  const sort = sortable ? state.sort! : 'id'
  const order = sortable && state.order ? state.order : sort === 'id' ? 'desc' : 'asc'
  const params: AliasListParams = { limit: size, offset: (page - 1) * size, sort, order }
  if (filters.q) params.q = filters.q
  if (filters.domain.length > 0) params.domain = [...filters.domain]
  if (filters.primaryDomain.length > 0) params.primaryDomain = [...filters.primaryDomain]
  if (filters.kind.length > 0) params.kind = [...filters.kind]
  if (filters.destinationType.length > 0) params.destinationType = [...filters.destinationType]
  if (filters.destination) params.destination = [filters.destination]
  for (const key of ['active', 'senderAllowed', 'internal'] as const) {
    const value = flag(filters[key])
    if (value !== undefined) params[key] = value
  }
  const visible = flag(filters.groupwareVisible)
  if (groupware && visible !== undefined) params.groupwareVisible = visible
  return params
}

export function useAliasListState(options: ListStateOptions = {}) {
  const list = useListState(aliasListSchema, options)
  return {
    ...list,
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
