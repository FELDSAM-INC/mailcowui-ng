// The address state of the API key list (FR-064, data-model §5): owner, status and access filters,
// the sort with its order, page and page size. Defaults are omitted from the address.
import {
  apiKeyAccessLevelValues,
  apiKeyStatusValues,
  componentsParametersApiKeySortValues,
  type ApiKeyAccessLevel,
  type ApiKeyListParams,
  type ApiKeyStatus,
} from '@/api'
import {
  oneOf,
  text,
  type ListSchema,
  type ListState,
  type SortOrder,
} from '@/shared/composables/useListState'
import { API_KEY_OWNER_MAX_LENGTH } from '@/shared/validation/limits'

export type ApiKeySort = (typeof componentsParametersApiKeySortValues)[number]

export interface ApiKeyFilters extends Record<string, unknown> {
  owner: string | undefined
  status: ApiKeyStatus | undefined
  access: ApiKeyAccessLevel | undefined
}

/** Newest first by default; the other sorts ascend by default. */
export const defaultApiKeyOrder = (sort: ApiKeySort): SortOrder =>
  sort === 'createdAt' ? 'desc' : 'asc'

export const apiKeyListSchema: ListSchema<ApiKeyFilters, ApiKeySort> = {
  filters: {
    owner: text({ maxLength: API_KEY_OWNER_MAX_LENGTH }),
    status: oneOf(apiKeyStatusValues),
    access: oneOf(apiKeyAccessLevelValues),
  },
  sort: {
    values: componentsParametersApiKeySortValues,
    default: 'createdAt',
    defaultOrder: defaultApiKeyOrder,
  },
}

/** The `listApiKeys` query of a list state. */
export function toApiKeyListParams(state: ListState<ApiKeyFilters, ApiKeySort>): ApiKeyListParams {
  const sort = state.sort ?? 'createdAt'
  const params: ApiKeyListParams = {
    limit: state.size,
    offset: (state.page - 1) * state.size,
    sort,
    order: state.order ?? defaultApiKeyOrder(sort),
  }
  if (state.filters.owner) params.ownerUsername = state.filters.owner
  if (state.filters.status) params.status = state.filters.status
  if (state.filters.access) params.accessLevel = state.filters.access
  return params
}
