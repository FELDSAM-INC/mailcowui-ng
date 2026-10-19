// The rate limit data layer (data-model §3, research R20): the limit of a domain, alias domain or
// mailbox under `['rate-limits', 'detail', kind, object]`, the overview's pages under
// `['rate-limits', 'list', params]`, and the writes through the client's mutation cache (session
// reactions apply). After a change or a removal the detail holds the new state, the overview is
// stale, a domain's mailboxes' limits are stale (their limit in effect), and so are the read-only
// values of the domain, alias domain and mailbox pages and lists (FR-086) and the audit log. A
// bucket reset changes nothing cached here (UI 011 refreshes its own log).
import { keepPreviousData, queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type ListMeta,
  type RateLimit,
  type RateLimitKind,
  type RateLimitListParams,
  type RateLimitUpdate,
} from '@/api'

export type { RateLimitKind } from '@/api'

export interface RateLimitPage {
  data: RateLimit[]
  meta: ListMeta
}

const STALE_TIME = 30_000

export async function fetchRateLimit(kind: RateLimitKind, object: string): Promise<RateLimit> {
  switch (kind) {
    case 'domain':
      return requireData(
        await api.GET('/domains/{domain}/rate-limit', { params: { path: { domain: object } } }),
      ).data
    case 'aliasDomain':
      return requireData(
        await api.GET('/alias-domains/{aliasDomain}/rate-limit', {
          params: { path: { aliasDomain: object } },
        }),
      ).data
    case 'mailbox':
      return requireData(
        await api.GET('/mailboxes/{mailbox}/rate-limit', { params: { path: { mailbox: object } } }),
      ).data
  }
}

export function rateLimitOptions(kind: RateLimitKind, object: string) {
  return queryOptions({
    queryKey: queryKeys.rateLimits.detail(kind, object),
    queryFn: () => fetchRateLimit(kind, object),
    staleTime: STALE_TIME,
  })
}

export function useRateLimit(
  kind: MaybeRefOrGetter<RateLimitKind>,
  object: MaybeRefOrGetter<string>,
) {
  return useQuery(computed(() => rateLimitOptions(toValue(kind), toValue(object))))
}

export async function fetchRateLimits(params: RateLimitListParams): Promise<RateLimitPage> {
  return requireData(await api.GET('/rate-limits', { params: { query: params } }))
}

export function rateLimitListOptions(params: RateLimitListParams) {
  return queryOptions({
    queryKey: queryKeys.rateLimits.list(params),
    queryFn: () => fetchRateLimits(params),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

async function putRateLimit(
  kind: RateLimitKind,
  object: string,
  body: RateLimitUpdate,
  ifMatch: string,
): Promise<RateLimit> {
  const header = { 'If-Match': ifMatch }
  switch (kind) {
    case 'domain':
      return requireData(
        await api.PUT('/domains/{domain}/rate-limit', {
          params: { path: { domain: object }, header },
          body,
        }),
      ).data
    case 'aliasDomain':
      return requireData(
        await api.PUT('/alias-domains/{aliasDomain}/rate-limit', {
          params: { path: { aliasDomain: object }, header },
          body,
        }),
      ).data
    case 'mailbox':
      return requireData(
        await api.PUT('/mailboxes/{mailbox}/rate-limit', {
          params: { path: { mailbox: object }, header },
          body,
        }),
      ).data
  }
}

async function deleteRateLimit(kind: RateLimitKind, object: string, ifMatch: string) {
  const header = { 'If-Match': ifMatch }
  switch (kind) {
    case 'domain':
      await api.DELETE('/domains/{domain}/rate-limit', {
        params: { path: { domain: object }, header },
      })
      return
    case 'aliasDomain':
      await api.DELETE('/alias-domains/{aliasDomain}/rate-limit', {
        params: { path: { aliasDomain: object }, header },
      })
      return
    case 'mailbox':
      await api.DELETE('/mailboxes/{mailbox}/rate-limit', {
        params: { path: { mailbox: object }, header },
      })
      return
  }
}

const inDomain = (address: unknown, domain: string) =>
  typeof address === 'string' && address.toLowerCase().endsWith(`@${domain.toLowerCase()}`)

/** What a change or removal of a limit makes stale (data-model §3, FR-086). */
export function afterRateLimitChange(
  client: QueryClient,
  kind: RateLimitKind,
  object: string,
  saved: RateLimit | null,
): void {
  const detail = queryKeys.rateLimits.detail(kind, object)
  if (saved) client.setQueryData(detail, saved)
  else void client.invalidateQueries({ queryKey: detail, exact: true })
  void client.invalidateQueries({ queryKey: queryKeys.rateLimits.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  switch (kind) {
    case 'domain':
      // The domain's mailboxes without their own limit take the domain's.
      void client.invalidateQueries({
        queryKey: queryKeys.rateLimits.kindDetails('mailbox'),
        predicate: (query) => inDomain(query.queryKey[3], object),
      })
      void client.invalidateQueries({ queryKey: queryKeys.domains.detail(object) })
      void client.invalidateQueries({ queryKey: queryKeys.domains.lists() })
      void client.invalidateQueries({
        queryKey: queryKeys.mailboxes.details(),
        predicate: (query) => inDomain(query.queryKey[2], object),
      })
      void client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() })
      return
    case 'aliasDomain':
      void client.invalidateQueries({ queryKey: queryKeys.aliasDomains.detail(object) })
      void client.invalidateQueries({ queryKey: queryKeys.aliasDomains.lists() })
      return
    case 'mailbox':
      void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(object) })
      void client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() })
      return
  }
}

/** `set<Kind>RateLimit` with the version tag read. */
export function setRateLimit(
  client: QueryClient,
  kind: RateLimitKind,
  object: string,
  body: RateLimitUpdate,
  ifMatch: string,
): Promise<RateLimit> {
  return runMutation(
    client,
    {
      mutationFn: (value: RateLimitUpdate) => putRateLimit(kind, object, value, ifMatch),
      onSuccess: (saved) => afterRateLimitChange(client, kind, object, saved),
    },
    body,
  )
}

/** `remove<Kind>RateLimit` with the version tag read (legacy: an empty value and Save, D2). */
export function removeRateLimit(
  client: QueryClient,
  kind: RateLimitKind,
  object: string,
  ifMatch: string,
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: () => deleteRateLimit(kind, object, ifMatch),
      onSuccess: () => afterRateLimitChange(client, kind, object, null),
    },
    undefined,
  )
}

/** `resetRateLimitBucket` (legacy "Remove hash"); a 404 means there was nothing to reset. */
export function resetRateLimitBucket(client: QueryClient, bucketId: string): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async (id: string) => {
        await api.DELETE('/rate-limit-buckets/{bucketId}', {
          params: { path: { bucketId: id } },
        })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    bucketId,
  )
}
