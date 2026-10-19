// The MTA-STS data layer (research R5, R17, data-model §3). The domain page's section reads
// `['mta-sts-policies', 'detail', domain]`, where `null` means that the domain has no policy (the
// API answers 404); the overview lists `['mta-sts-policies', 'list', params]`. Creations and
// changes run through the client's mutation cache (session reactions apply), write the policy the
// API returns, invalidate the lists and the audit log, and mark the domain as changed for the
// diagnostics when the identifier or the active state changed (R5).
import { keepPreviousData, queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type ListMeta,
  type MtaStsListParams,
  type MtaStsPolicy,
  type MtaStsPolicyCreateRequest,
  type MtaStsPolicyPatch,
} from '@/api'

export interface MtaStsPage {
  data: MtaStsPolicy[]
  meta: ListMeta
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

export async function fetchMtaStsPolicies(params: MtaStsListParams): Promise<MtaStsPage> {
  return requireData(await api.GET('/mta-sts-policies', { params: { query: params } }))
}

export function mtaStsListOptions(params: MtaStsListParams) {
  return queryOptions({
    queryKey: queryKeys.mtaStsPolicies.list(params),
    queryFn: () => fetchMtaStsPolicies(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/** The policy of a domain, or null when it has none (404). */
export async function fetchMtaStsPolicy(domain: string): Promise<MtaStsPolicy | null> {
  try {
    return requireData(
      await api.GET('/mta-sts-policies/{policyDomain}', {
        params: { path: { policyDomain: domain } },
      }),
    ).data
  } catch (error) {
    if (isApiProblem(error) && error.status === 404) return null
    throw error
  }
}

export function mtaStsPolicyOptions(domain: string) {
  return queryOptions({
    queryKey: queryKeys.mtaStsPolicies.detail(domain),
    queryFn: () => fetchMtaStsPolicy(domain),
    staleTime: 30_000,
  })
}

export function useMtaStsPolicy(domain: MaybeRefOrGetter<string>) {
  return useQuery(computed(() => mtaStsPolicyOptions(toValue(domain))))
}

/** After a creation or change: the policy in the detail, the lists stale, the change marked. */
export function afterPolicyChange(
  client: QueryClient,
  before: MtaStsPolicy | null,
  after: MtaStsPolicy,
): void {
  client.setQueryData(queryKeys.mtaStsPolicies.detail(after.domain), after)
  void client.invalidateQueries({ queryKey: queryKeys.mtaStsPolicies.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  if (!before || before.policyId !== after.policyId || before.active !== after.active) {
    client.setQueryData(queryKeys.dnsDiagnostics.changed(after.domain), { changedAt: Date.now() })
  }
}

export function createMtaStsPolicy(
  client: QueryClient,
  body: MtaStsPolicyCreateRequest,
): Promise<MtaStsPolicy> {
  return runMutation(
    client,
    {
      mutationFn: async (request: MtaStsPolicyCreateRequest) =>
        requireData(await api.POST('/mta-sts-policies', { body: request })).data,
      onSuccess: (policy) => afterPolicyChange(client, null, policy),
    },
    body,
  )
}

export function updateMtaStsPolicy(
  client: QueryClient,
  before: MtaStsPolicy,
  patch: MtaStsPolicyPatch,
  ifMatch: string,
): Promise<MtaStsPolicy> {
  return runMutation(
    client,
    {
      mutationFn: async (body: MtaStsPolicyPatch) =>
        requireData(
          await api.PATCH('/mta-sts-policies/{policyDomain}', {
            params: { path: { policyDomain: before.domain }, header: { 'If-Match': ifMatch } },
            body,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: (policy) => afterPolicyChange(client, before, policy),
    },
    patch,
  )
}
