// The alias data layer (data-model §3, research R18). Queries are keyed under `['aliases', …]`;
// detail queries start from a cached list entry and always fetch. Mutations (US2, US3, US6) run
// through the query client's mutation cache, so the session reactions apply to them, and they
// invalidate the caches data-model §3 names, including other features' derived numbers.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type Alias,
  type AliasBulkActionRequest,
  type AliasCopyOutcome,
  type AliasCopyReport,
  type AliasCreateRequest,
  type AliasListParams,
  type BulkResult,
  type AliasPatch,
  type ListMeta,
} from '@/api'
import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

import type { AliasCreateBody } from './alias-form'

export interface AliasPage {
  data: Alias[]
  meta: ListMeta
}

export async function fetchAliases(params: AliasListParams): Promise<AliasPage> {
  return requireData(await api.GET('/aliases', { params: { query: params } }))
}

export function aliasListOptions(params: AliasListParams) {
  return queryOptions({
    queryKey: queryKeys.aliases.list(params),
    queryFn: () => fetchAliases(params),
    staleTime: 30_000,
  })
}

export async function fetchAlias(id: number): Promise<Alias> {
  return requireData(await api.GET('/aliases/{aliasId}', { params: { path: { aliasId: id } } }))
    .data
}

/** An alias from a cached list page, so that the detail shows at once (research R18). */
export function cachedAlias(client: QueryClient, id: number): Alias | undefined {
  for (const [, page] of client.getQueriesData<AliasPage>({
    queryKey: queryKeys.aliases.lists(),
  })) {
    const found = page?.data.find((alias) => alias.id === id)
    if (found) return found
  }
  return undefined
}

export function aliasOptions(client: QueryClient, id: number) {
  return queryOptions({
    queryKey: queryKeys.aliases.detail(id),
    queryFn: () => fetchAlias(id),
    staleTime: 30_000,
    placeholderData: () => cachedAlias(client, id),
  })
}

export function useAlias(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => ({ ...aliasOptions(client, toValue(id)), retry: false })))
}

const PICKER_PAGE = { sort: 'name', order: 'asc' } as const

/**
 * The domains of the caller's scope for the domain pickers (FR-011), under UI 002's `domains` key,
 * so that domain mutations refresh them. Each option says whether it is a relay domain.
 */
export function domainPickerSource(label?: string): DomainPickerSource {
  return {
    id: 'domains',
    label,
    queryKey: (q) => [...queryKeys.domains.lists(), 'picker', { q }],
    fetchPage: async ({ q, offset, limit }) => {
      const page = requireData(
        await api.GET('/domains', {
          params: { query: { ...PICKER_PAGE, limit, offset, ...(q ? { q } : {}) } },
        }),
      )
      return {
        items: page.data.map((domain) => ({
          name: domain.name,
          nameUnicode: domain.unicodeName,
          relay: domain.backupMx,
        })),
        total: page.meta.total,
      }
    },
  }
}

/** The alias domains of the caller's scope, for the "Domain" filter (data-model §3). */
export function aliasDomainPickerSource(label?: string): DomainPickerSource {
  return {
    id: 'aliasDomains',
    label,
    queryKey: (q) => queryKeys.aliasDomains.options(q),
    fetchPage: async ({ q, offset, limit }) => {
      const page = requireData(
        await api.GET('/alias-domains', {
          params: { query: { ...PICKER_PAGE, limit, offset, ...(q ? { q } : {}) } },
        }),
      )
      return {
        items: page.data.map((item) => ({ name: item.name, nameUnicode: item.nameUnicode })),
        total: page.meta.total,
      }
    },
  }
}

// Mutations (data-model §3).

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

/** What an alias change makes stale: the lists, other features' derived numbers and senders. */
export function invalidateAfterAliasChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.aliases.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.aliasDomains.all() })
  void client.invalidateQueries({ queryKey: queryKeys.domains.all() })
  void client.invalidateQueries({ queryKey: queryKeys.senderSettings.all() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

export function createAlias(client: QueryClient, body: AliasCreateBody): Promise<Alias> {
  return runMutation(
    client,
    {
      // The omitted members take the contract's defaults (AliasCreateBody).
      mutationFn: async (request: AliasCreateBody) =>
        requireData(await api.POST('/aliases', { body: request as AliasCreateRequest })).data,
      onSuccess: (alias) => {
        client.setQueryData(queryKeys.aliases.detail(alias.id), alias)
        invalidateAfterAliasChange(client)
      },
    },
    body,
  )
}

export function updateAlias(
  client: QueryClient,
  id: number,
  patch: AliasPatch,
  ifMatch: string,
): Promise<Alias> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/aliases/{aliasId}', {
            params: { path: { aliasId: id }, header: { 'If-Match': ifMatch } },
            body: patch,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: (alias) => {
        client.setQueryData(queryKeys.aliases.detail(alias.id), alias)
        invalidateAfterAliasChange(client)
      },
    },
    undefined,
  )
}

export function deleteAlias(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/aliases/{aliasId}', {
          params: { path: { aliasId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.aliases.detail(id), exact: true })
        invalidateAfterAliasChange(client)
      },
    },
    undefined,
  )
}

/** A mass action (FR-057); a copy's outcomes per alias come back in `copies` (research R12). */
export function applyAliasBulkAction(
  client: QueryClient,
  body: AliasBulkActionRequest,
): Promise<{ result: BulkResult; extra?: Record<string, AliasCopyOutcome[]> }> {
  return runMutation(
    client,
    {
      mutationFn: async (request: AliasBulkActionRequest) => {
        const answer = requireData(await api.POST('/aliases/bulk-actions', { body: request }))
        return { result: answer.data, extra: answer.meta?.copies }
      },
      onSettled: () => invalidateAfterAliasChange(client),
    },
    body,
  )
}

/** "Expand alias over alias domains" for one alias, with its version (FR-031, research R12). */
export function copyAlias(
  client: QueryClient,
  id: number,
  ifMatch: string,
): Promise<AliasCopyReport> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/aliases/{aliasId}/alias-domain-copies', {
            params: { path: { aliasId: id }, header: { 'If-Match': ifMatch } },
          }),
        ).data,
      onSuccess: () => invalidateAfterAliasChange(client),
    },
    undefined,
  )
}
