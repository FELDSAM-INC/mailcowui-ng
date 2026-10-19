// The OAuth2 client data layer (research R22, data-model §3). Reads and secret-free changes go
// through the query client; creation and bulk actions call the generated client directly, because
// their answers carry secrets, which never enter a TanStack Query cache (docs/conventions.md
// "Secrets"). Only the representation without the secret is written to the cache.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type ListMeta,
  type Oauth2Client,
  type Oauth2ClientBulkActionRequest,
  type Oauth2ClientBulkResult,
  type Oauth2ClientListParams,
  type Oauth2ClientWithSecret,
} from '@/api'

export interface Oauth2ClientPage {
  data: Oauth2Client[]
  meta: ListMeta
}

export function oauth2CapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.oauth2Clients.capabilities(),
    queryFn: async () => requireData(await api.GET('/capabilities/oauth2-clients', {})).data,
    staleTime: 5 * 60_000,
  })
}

export function useOauth2Capabilities() {
  return useQuery(oauth2CapabilitiesOptions())
}

export async function fetchOauth2Clients(
  params: Oauth2ClientListParams,
): Promise<Oauth2ClientPage> {
  return requireData(await api.GET('/oauth2-clients', { params: { query: params } }))
}

export function oauth2ListOptions(params: Oauth2ClientListParams) {
  return queryOptions({
    queryKey: queryKeys.oauth2Clients.list(params),
    queryFn: () => fetchOauth2Clients(params),
    staleTime: 30_000,
  })
}

function cachedClient(
  client: QueryClient,
  id: number,
): { entry: Oauth2Client; updatedAt: number } | undefined {
  for (const [key, page] of client.getQueriesData<Oauth2ClientPage>({
    queryKey: queryKeys.oauth2Clients.lists(),
  })) {
    const entry = page?.data.find((item) => item.id === id)
    if (entry) return { entry, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export async function fetchOauth2Client(id: number): Promise<Oauth2Client> {
  return requireData(
    await api.GET('/oauth2-clients/{oauth2ClientId}', { params: { path: { oauth2ClientId: id } } }),
  ).data
}

/** The client page's read, seeded from a listed entry. */
export function oauth2ClientOptions(client: QueryClient, id: number) {
  return queryOptions({
    queryKey: queryKeys.oauth2Clients.detail(id),
    queryFn: () => fetchOauth2Client(id),
    staleTime: 30_000,
    initialData: () => cachedClient(client, id)?.entry,
    initialDataUpdatedAt: () => cachedClient(client, id)?.updatedAt,
  })
}

export function useOauth2Client(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => oauth2ClientOptions(client, toValue(id))))
}

function afterChange(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.oauth2Clients.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

function forgetOnNotFound(client: QueryClient, id: number, error: unknown) {
  if (isApiProblem(error) && error.status === 404) {
    client.removeQueries({ queryKey: queryKeys.oauth2Clients.detail(id) })
    void client.invalidateQueries({ queryKey: queryKeys.oauth2Clients.lists() })
  }
}

/** Creates a client. Its answer carries the secret, so it bypasses the query client. */
export async function createOauth2Client(redirectUris: string[]): Promise<Oauth2ClientWithSecret> {
  return requireData(await api.POST('/oauth2-clients', { body: { redirectUris } })).data
}

/** Writes a created client to the cache without its secret, and refreshes the lists. */
export function rememberCreatedClient(
  client: QueryClient,
  created: Oauth2ClientWithSecret,
): Oauth2Client {
  const { clientSecret: _secret, ...entry } = created
  client.setQueryData(queryKeys.oauth2Clients.detail(entry.id), entry)
  void afterChange(client)
  return entry
}

/** Replaces the redirect URIs (merge patch with If-Match). */
export function updateOauth2RedirectUris(
  client: QueryClient,
  id: number,
  redirectUris: string[],
  ifMatch: string,
): Promise<Oauth2Client> {
  return runMutation<Oauth2Client, string[]>(
    client,
    {
      mutationFn: async (uris) =>
        requireData(
          await api.PATCH('/oauth2-clients/{oauth2ClientId}', {
            params: { path: { oauth2ClientId: id }, header: { 'If-Match': ifMatch } },
            body: { redirectUris: uris },
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: async (saved) => {
        client.setQueryData(queryKeys.oauth2Clients.detail(saved.id), saved)
        await afterChange(client)
      },
      onError: (error) => forgetOnNotFound(client, id, error),
    },
    redirectUris,
  )
}

export function deleteOauth2Client(
  client: QueryClient,
  id: number,
  ifMatch: string,
): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/oauth2-clients/{oauth2ClientId}', {
          params: { path: { oauth2ClientId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.oauth2Clients.detail(id) })
        await afterChange(client)
      },
      onError: (error) => forgetOnNotFound(client, id, error),
    },
    undefined,
  )
}

/**
 * A bulk action on several clients (FR-065, gap G42). A `renewSecret` answer carries the new
 * secrets, so the request bypasses the query client; only the caches are refreshed afterwards.
 */
export async function bulkOauth2Clients(
  client: QueryClient,
  request: Oauth2ClientBulkActionRequest,
): Promise<Oauth2ClientBulkResult> {
  const result = requireData(await api.POST('/oauth2-clients/bulk-actions', { body: request })).data
  for (const item of result.results) {
    if (item.outcome === 'notFound' || (item.outcome === 'done' && request.action === 'delete')) {
      client.removeQueries({ queryKey: queryKeys.oauth2Clients.detail(Number(item.id)) })
    } else if (item.outcome === 'done') {
      void client.invalidateQueries({ queryKey: queryKeys.oauth2Clients.detail(Number(item.id)) })
    }
  }
  await afterChange(client)
  return result
}
