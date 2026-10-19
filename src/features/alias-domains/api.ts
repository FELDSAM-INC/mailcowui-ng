// The alias domain data layer (data-model §3, research R18). Queries are keyed under
// `['alias-domains', …]`; a detail starts from a cached list entry and always fetches. Mutations run
// through the query client's mutation cache, so the session reactions apply to them, and they
// invalidate what data-model §3 names: the alias domain and alias lists, the domains' derived
// numbers, sender settings and the audit log. A creation's report is returned to the page and never
// cached: the detail cache holds the plain alias domain.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type AliasDomain,
  type AliasDomainCreateRequest,
  type AliasDomainCreationReport,
  type AliasDomainListParams,
  type AliasDomainPatch,
  type ListMeta,
} from '@/api'

import type { AliasDomainCreateBody } from './alias-domain-form'

export interface AliasDomainPage {
  data: AliasDomain[]
  meta: ListMeta
}

export async function fetchAliasDomains(params: AliasDomainListParams): Promise<AliasDomainPage> {
  return requireData(await api.GET('/alias-domains', { params: { query: params } }))
}

export function aliasDomainListOptions(params: AliasDomainListParams) {
  return queryOptions({
    queryKey: queryKeys.aliasDomains.list(params),
    queryFn: () => fetchAliasDomains(params),
    staleTime: 30_000,
  })
}

export async function fetchAliasDomain(name: string): Promise<AliasDomain> {
  return requireData(
    await api.GET('/alias-domains/{aliasDomain}', { params: { path: { aliasDomain: name } } }),
  ).data
}

/** An alias domain from a cached list page, so that the page shows at once (research R18). */
export function cachedAliasDomain(client: QueryClient, name: string): AliasDomain | undefined {
  const key = name.toLowerCase()
  for (const [, page] of client.getQueriesData<AliasDomainPage>({
    queryKey: queryKeys.aliasDomains.lists(),
  })) {
    const found = page?.data.find((item) => item.name === key || item.nameUnicode === key)
    if (found) return found
  }
  return undefined
}

export function useAliasDomain(name: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  return useQuery(
    computed(() => {
      const value = toValue(name)
      return {
        queryKey: queryKeys.aliasDomains.detail(value),
        queryFn: () => fetchAliasDomain(value),
        staleTime: 30_000,
        retry: false,
        placeholderData: () => cachedAliasDomain(client, value),
      }
    }),
  )
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

/** What an alias domain change makes stale (data-model §3). */
export function invalidateAfterAliasDomainChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.aliasDomains.all() })
  void client.invalidateQueries({ queryKey: queryKeys.aliases.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.domains.all() })
  void client.invalidateQueries({ queryKey: queryKeys.senderSettings.all() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

export interface CreatedAliasDomain {
  aliasDomain: AliasDomain
  report: AliasDomainCreationReport
}

export function createAliasDomain(
  client: QueryClient,
  body: AliasDomainCreateBody,
): Promise<CreatedAliasDomain> {
  return runMutation(
    client,
    {
      // The omitted members take the contract's defaults (AliasDomainCreateBody).
      mutationFn: async (request: AliasDomainCreateBody) => {
        const { creationReport, ...aliasDomain } = requireData(
          await api.POST('/alias-domains', { body: request as AliasDomainCreateRequest }),
        ).data
        return { aliasDomain, report: creationReport }
      },
      onSuccess: ({ aliasDomain }) => {
        client.setQueryData(queryKeys.aliasDomains.detail(aliasDomain.name), aliasDomain)
        invalidateAfterAliasDomainChange(client)
      },
    },
    body,
  )
}

export function updateAliasDomain(
  client: QueryClient,
  name: string,
  patch: AliasDomainPatch,
  ifMatch: string,
): Promise<AliasDomain> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/alias-domains/{aliasDomain}', {
            params: { path: { aliasDomain: name }, header: { 'If-Match': ifMatch } },
            body: patch,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: (aliasDomain) => {
        client.setQueryData(queryKeys.aliasDomains.detail(aliasDomain.name), aliasDomain)
        invalidateAfterAliasDomainChange(client)
      },
    },
    undefined,
  )
}

export function deleteAliasDomain(
  client: QueryClient,
  name: string,
  ifMatch: string,
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/alias-domains/{aliasDomain}', {
          params: { path: { aliasDomain: name }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.aliasDomains.detail(name), exact: true })
        invalidateAfterAliasDomainChange(client)
      },
    },
    undefined,
  )
}
