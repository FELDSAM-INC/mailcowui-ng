// Server state of the API keys (T129, data-model §3): the list, a key, the key-owner candidates
// (an infinite query, 25 per page), creation and revocation. Creation goes through
// useSecretRequest, never a query cache: the secret is removed before the new key is written to
// the cache, and lists are invalidated.
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  ApiProblem,
  isApiProblem,
  queryKeys,
  requireData,
  type ApiKey,
  type ApiKeyCreated,
  type ApiKeyCreateRequest,
  type ApiKeyListParams,
  type ApiKeyOwnerCandidateParams,
  type Writable,
} from '@/api'

export const OWNER_CANDIDATES_PAGE_SIZE = 25

/** A query error as an ApiProblem (the client throws ApiProblem; anything else is a transport failure). */
export function queryProblem(error: unknown): ApiProblem | null {
  if (!error) return null
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'network', cause: error })
}

export async function fetchApiKeys(params: ApiKeyListParams) {
  return requireData(await api.GET('/api-keys', { params: { query: params } }))
}

export function apiKeysQuery(params: ApiKeyListParams) {
  return queryOptions({
    queryKey: queryKeys.apiKeys.list(params),
    queryFn: () => fetchApiKeys(params),
    placeholderData: keepPreviousData,
  })
}

export function useApiKeys(params: MaybeRefOrGetter<ApiKeyListParams>) {
  return useQuery(computed(() => apiKeysQuery(toValue(params))))
}

export async function fetchApiKey(apiKeyId: string): Promise<ApiKey> {
  return requireData(await api.GET('/api-keys/{apiKeyId}', { params: { path: { apiKeyId } } })).data
}

export function apiKeyQuery(apiKeyId: string) {
  return queryOptions({
    queryKey: queryKeys.apiKeys.detail(apiKeyId),
    queryFn: () => fetchApiKey(apiKeyId),
  })
}

export function useApiKey(apiKeyId: MaybeRefOrGetter<string>) {
  return useQuery(computed(() => apiKeyQuery(toValue(apiKeyId))))
}

/** Creates a key. The answer carries the one-time secret: use it through useSecretRequest only. */
export async function createApiKey(body: Writable<ApiKeyCreateRequest>): Promise<ApiKeyCreated> {
  return requireData(await api.POST('/api-keys', { body })).data
}

/** Writes a created key to the cache without its secret, and invalidates the lists. */
export function rememberCreatedKey(queryClient: QueryClient, created: ApiKeyCreated): ApiKey {
  const { secret: _secret, ...key } = created
  queryClient.setQueryData(queryKeys.apiKeys.detail(key.id), key)
  void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() })
  return key
}

export async function revokeApiKey(apiKeyId: string, ifMatch: string): Promise<ApiKey> {
  return requireData(
    await api.POST('/api-keys/{apiKeyId}/revocation', {
      params: { path: { apiKeyId }, header: { 'If-Match': ifMatch } },
    }),
  ).data
}

/** Writes a revoked key to the cache and invalidates the lists (the key stays listed). */
export function rememberRevokedKey(queryClient: QueryClient, key: ApiKey): void {
  queryClient.setQueryData(queryKeys.apiKeys.detail(key.id), key)
  void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() })
}

export function ownerCandidatesQuery(search: string) {
  const params: ApiKeyOwnerCandidateParams = search ? { q: search } : {}
  return infiniteQueryOptions({
    queryKey: queryKeys.apiKeys.ownerCandidates(params),
    queryFn: async ({ pageParam }) =>
      requireData(
        await api.GET('/api-keys/owner-candidates', {
          params: {
            query: { ...params, limit: OWNER_CANDIDATES_PAGE_SIZE, offset: pageParam },
          },
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.meta.offset + last.meta.limit
      return next < last.meta.total ? next : undefined
    },
  })
}

export function useOwnerCandidates(
  search: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useInfiniteQuery(
    computed(() => ({ ...ownerCandidatesQuery(toValue(search)), enabled: toValue(enabled) })),
  )
}
