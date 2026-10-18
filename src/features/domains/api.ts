// The domain data layer (UI 002 research D6, D7, data-model §3). Queries are keyed under
// `['domains', …]`, so one prefix invalidates everything that depends on domains. Mutations run
// through the query client's mutation cache, so the session reactions (an ended session, a
// pending action, "forbidden") apply to them too, and they patch the caches they can and
// invalidate the rest. Every mutation also invalidates the audit log.
import {
  queryOptions,
  useQuery,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  ApiProblem,
  api,
  isApiProblem,
  queryKeys,
  requireData,
  type BulkResult,
  type Domain,
  type DomainBulkActionRequest,
  type DomainCapabilities,
  type DomainCreated,
  type DomainCreateRequest,
  type DomainDeletionPreview,
  type DomainFooter,
  type DomainFooterReplace,
  type DomainListParams,
  type DomainPatch,
  type DomainTagParams,
  type ListMeta,
} from '@/api'

export interface DomainPage {
  data: Domain[]
  meta: ListMeta
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

/** A query or mutation error as a problem (the client turns every failure into ApiProblem). */
export function problemOf(error: unknown): ApiProblem | null {
  if (!error) return null
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'problem', cause: error })
}

/** Runs a mutation through the client's mutation cache (its default options and reactions). */
export function runMutation<TData, TVariables>(
  client: QueryClient,
  options: MutationOptions<TData, ApiProblem, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return client.getMutationCache().build(client, options).execute(variables)
}

// Queries

export async function fetchDomains(params: DomainListParams): Promise<DomainPage> {
  return requireData(await api.GET('/domains', { params: { query: params } }))
}

export function domainListOptions(params: DomainListParams) {
  return queryOptions({
    queryKey: queryKeys.domains.list(params),
    queryFn: () => fetchDomains(params),
    staleTime: 30_000,
  })
}

export async function fetchDomain(name: string): Promise<Domain> {
  return requireData(await api.GET('/domains/{domain}', { params: { path: { domain: name } } }))
    .data
}

/** A domain from a cached list, with that list's update time (research D6). */
export function cachedDomain(
  client: QueryClient,
  name: string,
): { domain: Domain; updatedAt: number } | undefined {
  const lists = client.getQueriesData<DomainPage>({ queryKey: queryKeys.domains.lists() })
  for (const [key, page] of lists) {
    const domain = page?.data.find((item) => item.name === name)
    if (domain) return { domain, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

/** The domain page's query, seeded from a cached list entry (same version tag, API 002 FR-015). */
export function domainOptions(client: QueryClient, name: string) {
  return queryOptions({
    queryKey: queryKeys.domains.detail(name),
    queryFn: () => fetchDomain(name),
    staleTime: 30_000,
    initialData: () => cachedDomain(client, name)?.domain,
    initialDataUpdatedAt: () => cachedDomain(client, name)?.updatedAt,
  })
}

export function useDomain(name: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  return useQuery(computed(() => domainOptions(client, toValue(name))))
}

export async function fetchFooter(name: string): Promise<DomainFooter> {
  return requireData(
    await api.GET('/domains/{domain}/footer', { params: { path: { domain: name } } }),
  ).data
}

export function footerOptions(name: string) {
  return queryOptions({
    queryKey: queryKeys.domains.footer(name),
    queryFn: () => fetchFooter(name),
    staleTime: 30_000,
  })
}

export function useDomainFooter(
  name: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery(computed(() => ({ ...footerOptions(toValue(name)), enabled: toValue(enabled) })))
}

/** The page size of each list the footer's exclusion choice reads. */
export const EXCLUSION_PAGE_SIZE = 100

export interface ExclusionCandidates {
  mailboxes: string[]
  aliases: string[]
  aliasDomains: string[]
  /** One of the lists has more entries than one page: the choice offers a search. */
  more: boolean
}

/**
 * The candidates of the footer's exclusions, as the classic tab lists them: the domain's mailboxes,
 * aliases and alias domains (features 003 and 004), each searched by `q` and limited to one page.
 */
export async function fetchExclusionCandidates(
  domain: string,
  q: string,
): Promise<ExclusionCandidates> {
  const paging = { limit: EXCLUSION_PAGE_SIZE, offset: 0, ...(q ? { q } : {}) }
  const [mailboxes, aliases, aliasDomains] = await Promise.all([
    api.GET('/mailboxes', {
      params: { query: { ...paging, domain: [domain], sort: 'address', order: 'asc' } },
    }),
    api.GET('/aliases', {
      params: { query: { ...paging, domain: [domain], sort: 'address', order: 'asc' } },
    }),
    api.GET('/alias-domains', {
      params: { query: { ...paging, targetDomain: [domain], sort: 'name', order: 'asc' } },
    }),
  ])
  const m = requireData(mailboxes)
  const a = requireData(aliases)
  const d = requireData(aliasDomains)
  return {
    mailboxes: m.data.map((item) => item.address),
    aliases: a.data.map((item) => item.address),
    aliasDomains: d.data.map((item) => item.name),
    more: [m, a, d].some((page) => page.meta.total > page.data.length),
  }
}

export function exclusionCandidatesOptions(domain: string, q: string) {
  return queryOptions({
    queryKey: queryKeys.domains.exclusionCandidates(domain, q),
    queryFn: () => fetchExclusionCandidates(domain, q),
    staleTime: 30_000,
  })
}

/** The deletion preview is fetched fresh every time a deletion starts (staleTime and gcTime 0). */
export async function fetchDeletionPreview(
  client: QueryClient,
  name: string,
): Promise<DomainDeletionPreview> {
  const key = queryKeys.domains.deletionPreview(name)
  try {
    return await client.fetchQuery({
      queryKey: queryKeys.domains.deletionPreview(name),
      queryFn: async () =>
        requireData(
          await api.GET('/domains/{domain}/deletion-preview', {
            params: { path: { domain: name } },
          }),
        ).data,
      staleTime: 0,
      gcTime: 0,
    })
  } finally {
    client.removeQueries({ queryKey: key, exact: true })
  }
}

export function capabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.domains.capabilities(),
    // openapi-fetch's `Readable` drops a member whose only type is `null`
    // (`templateDefaults.rateLimit`), which the response always carries.
    queryFn: async (): Promise<DomainCapabilities> =>
      requireData(await api.GET('/capabilities/domains')).data as DomainCapabilities,
    staleTime: 300_000,
  })
}

export function tagsOptions(params: DomainTagParams) {
  return queryOptions({
    queryKey: queryKeys.domains.tags(params),
    queryFn: async () => requireData(await api.GET('/domain-tags', { params: { query: params } })),
    staleTime: 30_000,
  })
}

// Cache rules shared by the mutations

function invalidateAudit(client: QueryClient) {
  return client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

/** Writes a domain to its detail and to every cached list page that holds it. */
export function writeDomain(client: QueryClient, domain: Domain): void {
  client.setQueryData(queryKeys.domains.detail(domain.name), domain)
  client.setQueriesData<DomainPage>({ queryKey: queryKeys.domains.lists() }, (page) =>
    page
      ? { ...page, data: page.data.map((item) => (item.name === domain.name ? domain : item)) }
      : page,
  )
}

/** A domain that no longer exists or left the scope: remove its caches, refresh the lists. */
export function forgetDomain(client: QueryClient, name: string): void {
  client.removeQueries({ queryKey: queryKeys.domains.detail(name) })
  client.removeQueries({ queryKey: queryKeys.domains.footer(name) })
  client.removeQueries({ queryKey: queryKeys.domains.deletionPreview(name) })
  void client.invalidateQueries({ queryKey: queryKeys.domains.lists() })
}

function onDomainError(client: QueryClient, name: string, error: unknown): void {
  if (!isApiProblem(error)) return
  if (error.is('attribute-not-permitted')) {
    void client.invalidateQueries({ queryKey: queryKeys.identity() })
  }
  if (error.status === 404) {
    // The page keeps showing what it had and says the domain is gone (spec edge case).
    client.removeQueries({ queryKey: queryKeys.domains.footer(name) })
    void client.invalidateQueries({ queryKey: queryKeys.domains.lists() })
  }
}

// Mutations

export function createDomain(
  client: QueryClient,
  body: DomainCreateRequest,
): Promise<DomainCreated> {
  return runMutation<DomainCreated, DomainCreateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/domains', { body: request })).data,
      onSuccess: async (created) => {
        const { creationReport, ...domain } = created
        client.setQueryData(queryKeys.domains.detail(domain.name), domain)
        client.setQueryData(queryKeys.domains.creationReport(domain.name), creationReport)
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.domains.lists() }),
          client.invalidateQueries({ queryKey: queryKeys.domains.tagLists() }),
          invalidateAudit(client),
        ])
      },
    },
    body,
  )
}

export function updateDomain(
  client: QueryClient,
  name: string,
  patch: DomainPatch,
  ifMatch: string,
): Promise<Domain> {
  return runMutation<Domain, DomainPatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/domains/{domain}', {
            params: { path: { domain: name }, header: { 'If-Match': ifMatch } },
            body,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: async (domain, body) => {
        writeDomain(client, domain)
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.domains.lists() }),
          'tags' in body
            ? client.invalidateQueries({ queryKey: queryKeys.domains.tagLists() })
            : Promise.resolve(),
          invalidateAudit(client),
        ])
      },
      onError: (error) => onDomainError(client, name, error),
    },
    patch,
  )
}

export function deleteDomain(client: QueryClient, name: string, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/domains/{domain}', {
          params: { path: { domain: name }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        forgetDomain(client, name)
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.domains.tagLists() }),
          invalidateAudit(client),
        ])
      },
      onError: (error) => {
        if (isApiProblem(error) && error.status === 404) forgetDomain(client, name)
      },
    },
    undefined,
  )
}

export function applyBulkAction(
  client: QueryClient,
  request: DomainBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, DomainBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/domains/bulk-actions', { body })).data,
      onSuccess: async (result, body) => {
        for (const item of result.results) {
          if (
            item.outcome === 'notFound' ||
            (item.outcome === 'done' && body.action === 'delete')
          ) {
            client.removeQueries({ queryKey: queryKeys.domains.detail(item.id) })
            client.removeQueries({ queryKey: queryKeys.domains.footer(item.id) })
          } else if (item.outcome === 'done') {
            void client.invalidateQueries({ queryKey: queryKeys.domains.detail(item.id) })
          }
        }
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.domains.lists() }),
          client.invalidateQueries({ queryKey: queryKeys.domains.tagLists() }),
          invalidateAudit(client),
        ])
      },
    },
    request,
  )
}

export function replaceFooter(
  client: QueryClient,
  name: string,
  body: DomainFooterReplace,
  ifMatch: string,
): Promise<DomainFooter> {
  return runMutation<DomainFooter, DomainFooterReplace>(
    client,
    {
      mutationFn: async (request) =>
        requireData(
          await api.PUT('/domains/{domain}/footer', {
            params: { path: { domain: name }, header: { 'If-Match': ifMatch } },
            body: request,
          }),
        ).data,
      onSuccess: async (footer) => {
        client.setQueryData(queryKeys.domains.footer(name), footer)
        // The domain carries a footer summary (`Domain.footer`, API gap G28).
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.domains.detail(name) }),
          client.invalidateQueries({ queryKey: queryKeys.domains.lists() }),
          invalidateAudit(client),
        ])
      },
      onError: (error) => onDomainError(client, name, error),
    },
    body,
  )
}

export { ApiProblem }
