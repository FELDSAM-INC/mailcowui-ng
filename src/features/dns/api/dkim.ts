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
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type DkimDnsPublicationOutcome,
  type DkimKey,
  type DkimKeyChangeResult,
  type DkimKeyGenerateRequest,
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

/** The entry part of a change result, as the detail query holds it. */
export function entryOf(result: DkimKeyChangeResult): DkimKey {
  const { dnsPublication: _outcome, ...entry } = result
  return entry
}

function invalidateLists(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.copyTargetLists() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

/** After a key change: the result in the detail, the lists stale, the name marked as changed. */
export function afterKeyChange(client: QueryClient, result: DkimKeyChangeResult | DkimKey): void {
  const entry = 'dnsPublication' in result ? entryOf(result) : result
  client.setQueryData(queryKeys.dkimKeys.detail(entry.name), entry)
  invalidateLists(client)
  markDnsChanged(client, entry.name)
}

/** A key that changed elsewhere or vanished: the detail is read again. */
function refetchOnConflict(client: QueryClient, name: string, error: unknown): void {
  if (!isApiProblem(error)) return
  if (error.status === 409 || error.status === 404 || error.status === 412) {
    void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.detail(name) })
    invalidateLists(client)
  }
}

const ifMatchHeader = (ifMatch?: string | null) => (ifMatch ? { 'If-Match': ifMatch } : {})

// Mutations

/**
 * Generates a key for one name (FR-025); with `overwrite` and the old key's version tag it
 * replaces a key atomically (FR-090, administrators).
 */
export function generateKey(
  client: QueryClient,
  body: DkimKeyGenerateRequest,
  ifMatch?: string | null,
): Promise<DkimKeyChangeResult> {
  return runMutation<DkimKeyChangeResult, DkimKeyGenerateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(
          await api.POST('/dkim-keys', {
            params: { header: ifMatchHeader(ifMatch) },
            body: request,
          }),
        ).data,
      onSuccess: (result) => afterKeyChange(client, result),
      onError: (error, request) => refetchOnConflict(client, request.name, error),
    },
    body,
  )
}

/** Copies a key to one target (FR-036); a target with a key needs `overwrite` and its tag. */
export function copyKey(
  client: QueryClient,
  source: string,
  target: string,
  overwrite: { ifMatch: string } | null,
): Promise<DkimKeyChangeResult> {
  return runMutation<DkimKeyChangeResult, string>(
    client,
    {
      mutationFn: async (to) =>
        requireData(
          await api.POST('/dkim-keys/{dkimName}/copy', {
            params: { path: { dkimName: source }, header: ifMatchHeader(overwrite?.ifMatch) },
            body: { target: to, overwrite: overwrite !== null },
          }),
        ).data,
      onSuccess: (result) => afterKeyChange(client, result),
      onError: (error, to) => refetchOnConflict(client, to, error),
    },
    target,
  )
}

/** Deletes one key with its version tag (FR-037); an unused key's entry disappears. */
export function deleteKey(client: QueryClient, entry: DkimKey, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/dkim-keys/{dkimName}', {
          params: { path: { dkimName: entry.name }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () => {
        if (entry.kind === 'none') {
          client.removeQueries({ queryKey: queryKeys.dkimKeys.detail(entry.name), exact: true })
        } else {
          void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.detail(entry.name) })
        }
        invalidateLists(client)
        markDnsChanged(client, entry.name)
      },
      onError: (error) => refetchOnConflict(client, entry.name, error),
    },
    undefined,
  )
}

export interface BulkDeletion {
  result: BulkResult
  /** The publication outcome per deleted name, while the server publishes records. */
  publication: Record<string, DkimDnsPublicationOutcome>
}

/** Deletes several keys in one request with their version tags (FR-092). */
export function deleteKeys(
  client: QueryClient,
  targets: readonly { id: string; version?: string }[],
): Promise<BulkDeletion> {
  return runMutation<BulkDeletion, void>(
    client,
    {
      mutationFn: async () => {
        const data = requireData(
          await api.POST('/dkim-keys/bulk-actions', {
            body: { action: 'delete', targets: targets.map((target) => ({ ...target })) },
          }),
        )
        return { result: data.data, publication: data.meta?.dnsPublication ?? {} }
      },
      onSuccess: ({ result }) => {
        for (const item of result.results) {
          if (item.outcome === 'done' || item.outcome === 'notFound') {
            void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.detail(item.id) })
            markDnsChanged(client, item.id)
          }
        }
        invalidateLists(client)
      },
    },
    undefined,
  )
}

/** Publishes a key's DNS record again (FR-045, administrators, while publication is on). */
export function publishRecord(
  client: QueryClient,
  name: string,
  ifMatch: string,
): Promise<DkimKeyChangeResult> {
  return runMutation<DkimKeyChangeResult, void>(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/dkim-keys/{dkimName}/dns-publication', {
            params: { path: { dkimName: name }, header: { 'If-Match': ifMatch } },
          }),
        ).data,
      onSuccess: (result) => {
        client.setQueryData(queryKeys.dkimKeys.detail(result.name), entryOf(result))
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
      onError: (error) => refetchOnConflict(client, name, error),
    },
    undefined,
  )
}
