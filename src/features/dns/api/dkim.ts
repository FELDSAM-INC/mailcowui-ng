// The DKIM data layer (research R5, data-model §3). Lists and details are TanStack queries under
// `['dkim-keys', …]`; the entry page, the domain page's DKIM section and the import lookup read the
// same detail key, so every screen shows a change at once (FR-089). Mutations run through the
// client's mutation cache (session reactions apply), write the non-secret result into the detail,
// invalidate the lists and mark the name as changed for the diagnostics (R5). Requests that carry a
// private key never come here (`dkim-secrets.ts`).
import { keepPreviousData, queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  type DkimKey,
  type DkimListParams,
  type ListMeta,
} from '@/api'

export interface DkimPage {
  data: DkimKey[]
  meta: ListMeta
}

export async function fetchDkimKeys(params: DkimListParams): Promise<DkimPage> {
  return requireData(await api.GET('/dkim-keys', { params: { query: params } }))
}

export function dkimListOptions(params: DkimListParams) {
  return queryOptions({
    queryKey: queryKeys.dkimKeys.list(params),
    queryFn: () => fetchDkimKeys(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export async function fetchDkimKey(name: string): Promise<DkimKey> {
  return requireData(
    await api.GET('/dkim-keys/{dkimName}', { params: { path: { dkimName: name } } }),
  ).data
}

export function dkimKeyOptions(name: string) {
  return queryOptions({
    queryKey: queryKeys.dkimKeys.detail(name),
    queryFn: () => fetchDkimKey(name),
    staleTime: 30_000,
  })
}

export function useDkimKey(
  name: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery(
    computed(() => ({
      ...dkimKeyOptions(toValue(name)),
      enabled: toValue(enabled) && !!toValue(name),
    })),
  )
}

/** Records that a name's key changed in this app, for the diagnostics "changed" notice (R5). */
export function markDnsChanged(client: QueryClient, name: string, at = Date.now()): void {
  client.setQueryData(queryKeys.dnsDiagnostics.changed(name), { changedAt: at })
}

/** After a key change: the result in the detail, the lists stale, the name marked as changed. */
export function afterKeyChange(client: QueryClient, entry: DkimKey): void {
  const { etag, ...rest } = entry as DkimKey & { dnsPublication?: unknown }
  delete (rest as { dnsPublication?: unknown }).dnsPublication
  client.setQueryData(queryKeys.dkimKeys.detail(entry.name), { ...rest, etag } as DkimKey)
  void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.copyTargetLists() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  markDnsChanged(client, entry.name)
}
