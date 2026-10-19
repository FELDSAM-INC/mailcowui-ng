// The resource data layer (data-model §3, research R18). Queries are keyed under
// `['resources', …]`; a detail starts from a cached list entry and always fetches. Mutations run
// through the query client's mutation cache, so the session reactions apply to them, and they
// invalidate the resource lists, the domains' resource counts and the audit log.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type ListMeta,
  type Resource,
  type ResourceBulkActionRequest,
  type ResourceCreateRequest,
  type ResourceListParams,
  type ResourcePatch,
} from '@/api'

import type { ResourceCreateBody } from './resource-form'

export interface ResourcePage {
  data: Resource[]
  meta: ListMeta
}

export async function fetchResources(params: ResourceListParams): Promise<ResourcePage> {
  return requireData(await api.GET('/resources', { params: { query: params } }))
}

export function resourceListOptions(params: ResourceListParams) {
  return queryOptions({
    queryKey: queryKeys.resources.list(params),
    queryFn: () => fetchResources(params),
    staleTime: 30_000,
  })
}

export async function fetchResource(address: string): Promise<Resource> {
  return requireData(
    await api.GET('/resources/{resourceAddress}', {
      params: { path: { resourceAddress: address } },
    }),
  ).data
}

export function cachedResource(client: QueryClient, address: string): Resource | undefined {
  const key = address.toLowerCase()
  for (const [, page] of client.getQueriesData<ResourcePage>({
    queryKey: queryKeys.resources.lists(),
  })) {
    const found = page?.data.find((item) => item.address.toLowerCase() === key)
    if (found) return found
  }
  return undefined
}

export function useResource(address: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  return useQuery(
    computed(() => {
      const value = toValue(address)
      return {
        queryKey: queryKeys.resources.detail(value),
        queryFn: () => fetchResource(value),
        staleTime: 30_000,
        retry: false,
        placeholderData: () => cachedResource(client, value),
      }
    }),
  )
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

export function invalidateAfterResourceChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.resources.all() })
  void client.invalidateQueries({ queryKey: queryKeys.domains.all() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

export function createResource(client: QueryClient, body: ResourceCreateBody): Promise<Resource> {
  return runMutation(
    client,
    {
      mutationFn: async (request: ResourceCreateBody) =>
        requireData(await api.POST('/resources', { body: request as ResourceCreateRequest })).data,
      onSuccess: (resource) => {
        client.setQueryData(queryKeys.resources.detail(resource.address), resource)
        invalidateAfterResourceChange(client)
      },
    },
    body,
  )
}

export function updateResource(
  client: QueryClient,
  address: string,
  patch: ResourcePatch,
  ifMatch: string,
): Promise<Resource> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/resources/{resourceAddress}', {
            params: { path: { resourceAddress: address }, header: { 'If-Match': ifMatch } },
            body: patch,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: (resource) => {
        client.setQueryData(queryKeys.resources.detail(resource.address), resource)
        invalidateAfterResourceChange(client)
      },
    },
    undefined,
  )
}

export function deleteResource(
  client: QueryClient,
  address: string,
  ifMatch: string,
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/resources/{resourceAddress}', {
          params: { path: { resourceAddress: address }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.resources.detail(address), exact: true })
        invalidateAfterResourceChange(client)
      },
    },
    undefined,
  )
}

export function applyResourceBulkAction(
  client: QueryClient,
  body: ResourceBulkActionRequest,
): Promise<{ result: BulkResult }> {
  return runMutation(
    client,
    {
      mutationFn: async (request: ResourceBulkActionRequest) => ({
        result: requireData(await api.POST('/resources/bulk-actions', { body: request })).data,
      }),
      onSettled: () => invalidateAfterResourceChange(client),
    },
    body,
  )
}
