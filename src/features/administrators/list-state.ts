import {
  accountSecondFactorStatusValues,
  domainAdminPermissionNameValues,
  componentsParametersAdminSortValues,
  componentsParametersDomainAdminSortValues,
  type AccountSecondFactorStatus,
  type DomainAdminListParams,
  type DomainAdminPermissionName,
} from '@/api'
import {
  oneOf,
  manyText,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
  type ParamSpec,
} from '@/shared/composables/useListState'

export type AccountSort = NonNullable<DomainAdminListParams['sort']>
export type AdminSort = (typeof componentsParametersAdminSortValues)[number]
export interface AccountFilters extends Record<string, unknown> {
  q: string | undefined
  status: 'active' | 'inactive' | undefined
  tfa: AccountSecondFactorStatus | undefined
  pending: 'passwordChange' | 'secondFactorSetup' | undefined
  domain: string[]
  permission: DomainAdminPermissionName | undefined
  permissionValue: 'on' | 'off'
}
const permissionValue: ParamSpec<'on' | 'off'> = {
  parse: (raw) => (raw === 'off' ? 'off' : 'on'),
  serialize: (value) => (value === 'off' ? 'off' : undefined),
  isSet: (value) => value === 'off',
}
const common = {
  q: text({ maxLength: 255 }),
  status: oneOf(['active', 'inactive']),
  tfa: oneOf(accountSecondFactorStatusValues),
  pending: oneOf(['passwordChange', 'secondFactorSetup']),
}
export const domainAdminListSchema: ListSchema<AccountFilters, AccountSort> = {
  filters: {
    ...common,
    domain: manyText({ max: 100, maxLength: 255 }),
    permission: oneOf(domainAdminPermissionNameValues),
    permissionValue,
  },
  sort: {
    values: componentsParametersDomainAdminSortValues,
    default: 'username',
    defaultOrder: () => 'asc',
  },
}
export const adminListSchema: ListSchema<
  Pick<AccountFilters, 'q' | 'status' | 'tfa' | 'pending'>,
  AdminSort
> = {
  filters: common,
  sort: {
    values: componentsParametersAdminSortValues,
    default: 'username',
    defaultOrder: () => 'asc',
  },
}
export function toAccountParams({
  filters,
  sort,
  order,
  page,
  size,
}: ListState<Partial<AccountFilters>, AccountSort>): DomainAdminListParams {
  const params: DomainAdminListParams = {
    sort: sort ?? 'username',
    order: order ?? 'asc',
    offset: (page - 1) * size,
    limit: size,
  }
  if (filters.q) params.q = filters.q
  if (filters.status) params.active = filters.status === 'active'
  if (filters.tfa) params.secondFactorStatus = filters.tfa
  if (filters.pending === 'passwordChange') params.forcePasswordChange = true
  if (filters.pending === 'secondFactorSetup') params.forceSecondFactorSetup = true
  if (filters.domain?.length) params.domain = [...filters.domain]
  if (filters.permission) {
    params.permission = filters.permission
    params.permissionValue = filters.permissionValue !== 'off'
  }
  return params
}
export const useDomainAdminListState = (options: ListStateOptions = {}) =>
  useListState(domainAdminListSchema, options)
export const useAdminListState = (options: ListStateOptions = {}) =>
  useListState(adminListSchema, options)
