import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type Admin,
  type DomainAdmin,
  type AdminCreateRequest,
  type DomainAdminCreateRequest,
  type DomainAdminPatch,
  type AdminListParams,
  type DomainAdminListParams,
  type AccountBulkActionRequest,
  type Writable,
} from '@/api'

export type AccountRole = 'admin' | 'domainAdmin'
export type ManagedAccount = Admin | DomainAdmin
export type AccountCreateBody = Writable<AdminCreateRequest> | Writable<DomainAdminCreateRequest>
export type AccountPatch = Omit<Writable<DomainAdminPatch>, 'password'>
const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }
export const accountKeys = (role: AccountRole) =>
  role === 'admin' ? queryKeys.admins : queryKeys.domainAdmins

export async function fetchAccounts(role: AccountRole, params: DomainAdminListParams) {
  return role === 'admin'
    ? requireData(await api.GET('/admins', { params: { query: params as AdminListParams } }))
    : requireData(await api.GET('/domain-admins', { params: { query: params } }))
}
export function accountListOptions(role: AccountRole, params: DomainAdminListParams) {
  return queryOptions({
    queryKey: accountKeys(role).list(params as AdminListParams),
    queryFn: () => fetchAccounts(role, params),
    staleTime: 30_000,
  })
}
export async function fetchAccount(role: AccountRole, username: string): Promise<ManagedAccount> {
  return role === 'admin'
    ? requireData(await api.GET('/admins/{username}', { params: { path: { username } } })).data
    : requireData(await api.GET('/domain-admins/{username}', { params: { path: { username } } }))
        .data
}
export function useAccount(
  role: MaybeRefOrGetter<AccountRole>,
  username: MaybeRefOrGetter<string>,
) {
  const client = useQueryClient()
  return useQuery(
    computed(() => {
      const kind = toValue(role),
        name = toValue(username)
      return {
        queryKey: accountKeys(kind).detail(name),
        queryFn: () => fetchAccount(kind, name),
        staleTime: 0,
        retry: false,
        placeholderData: () => {
          for (const [, page] of client.getQueriesData<{ data: ManagedAccount[] }>({
            queryKey: accountKeys(kind).lists(),
          })) {
            const found = page?.data.find(
              (item) => item.username.toLowerCase() === name.toLowerCase(),
            )
            if (found) return found
          }
          return undefined
        },
      }
    }),
  )
}
export function accountCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.capabilities.accounts(),
    queryFn: async () => requireData(await api.GET('/capabilities/accounts')).data,
    staleTime: 300_000,
  })
}
export function useAccountCapabilities() {
  return useQuery(accountCapabilitiesOptions())
}
export function activeAdminCountOptions() {
  return queryOptions({
    queryKey: queryKeys.admins.activeCount(),
    queryFn: async () =>
      requireData(await api.GET('/admins', { params: { query: { active: true, limit: 1 } } })).meta
        .total,
    staleTime: 30_000,
  })
}
function invalidate(client: QueryClient, role: AccountRole): void {
  void client.invalidateQueries({ queryKey: accountKeys(role).lists() })
  if (role === 'admin') void client.invalidateQueries({ queryKey: queryKeys.admins.activeCount() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
export function rememberAccount(
  client: QueryClient,
  role: AccountRole,
  item: ManagedAccount,
  previousUsername?: string,
): void {
  if (previousUsername && previousUsername.toLowerCase() !== item.username.toLowerCase())
    client.removeQueries({ queryKey: accountKeys(role).detail(previousUsername), exact: true })
  client.setQueryData(accountKeys(role).detail(item.username), item)
  invalidate(client, role)
}
/** Called only through useSecretRequest: passwords never enter mutation variables. */
export async function createAccount(
  role: AccountRole,
  body: AccountCreateBody,
): Promise<ManagedAccount> {
  return role === 'admin'
    ? requireData(await api.POST('/admins', { body: body })).data
    : requireData(
        await api.POST('/domain-admins', { body: body as Writable<DomainAdminCreateRequest> }),
      ).data
}
async function patchAccount(
  role: AccountRole,
  username: string,
  body: Writable<DomainAdminPatch>,
  ifMatch: string,
): Promise<ManagedAccount> {
  const params = { path: { username }, header: { 'If-Match': ifMatch } }
  return role === 'admin'
    ? requireData(
        await api.PATCH('/admins/{username}', {
          params,
          body: body,
          headers: MERGE_PATCH,
        }),
      ).data
    : requireData(
        await api.PATCH('/domain-admins/{username}', {
          params,
          body: body,
          headers: MERGE_PATCH,
        }),
      ).data
}
/** The only public password update is direct, with caller-owned secret request state. */
export function changeAccountPassword(
  role: AccountRole,
  username: string,
  password: string,
  ifMatch: string,
): Promise<ManagedAccount> {
  return patchAccount(role, username, { password }, ifMatch)
}
export function updateAccount(
  client: QueryClient,
  role: AccountRole,
  username: string,
  patch: AccountPatch,
  ifMatch: string,
): Promise<ManagedAccount> {
  return runMutation(
    client,
    {
      mutationFn: () => patchAccount(role, username, patch, ifMatch),
      onSuccess: (item) => rememberAccount(client, role, item, username),
    },
    undefined,
  )
}
export function suspendAccountSecondFactors(
  client: QueryClient,
  role: AccountRole,
  username: string,
  ifMatch: string,
): Promise<ManagedAccount> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        const params = { path: { username }, header: { 'If-Match': ifMatch } }
        return role === 'admin'
          ? requireData(await api.POST('/admins/{username}/second-factor-suspension', { params }))
              .data
          : requireData(
              await api.POST('/domain-admins/{username}/second-factor-suspension', { params }),
            ).data
      },
      onSuccess: (item) => rememberAccount(client, role, item),
    },
    undefined,
  )
}
export function deleteAccount(
  client: QueryClient,
  role: AccountRole,
  username: string,
  ifMatch: string,
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        const params = { path: { username }, header: { 'If-Match': ifMatch } }
        if (role === 'admin') await api.DELETE('/admins/{username}', { params })
        else await api.DELETE('/domain-admins/{username}', { params })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: accountKeys(role).detail(username), exact: true })
        invalidate(client, role)
      },
    },
    undefined,
  )
}
export function applyAccountBulkAction(
  client: QueryClient,
  role: AccountRole,
  body: AccountBulkActionRequest,
) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        role === 'admin'
          ? requireData(await api.POST('/admins/bulk-actions', { body })).data
          : requireData(await api.POST('/domain-admins/bulk-actions', { body })).data,
      onSuccess: (result) => {
        for (const item of result.results)
          if (item.outcome === 'done')
            void client.invalidateQueries({ queryKey: accountKeys(role).detail(item.id) })
        invalidate(client, role)
      },
    },
    undefined,
  )
}

/** The classic account form can change metadata together with a password, in one atomic PATCH. */
export function updateAccountWithPassword(
  role: AccountRole,
  username: string,
  patch: AccountPatch & { password: string },
  ifMatch: string,
): Promise<ManagedAccount> {
  return patchAccount(role, username, patch, ifMatch)
}
