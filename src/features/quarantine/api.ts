// The quarantine API calls and their cache rules (UI 006 data-model §3, research R25). The
// quarantine area never imports the spam filter or rate limit areas (research R4), which is why the
// statistics query lives here although its key root is `spam-policy`.
//
// Items (US1, US2): the list and the item are cached for 30 s, the item kept for 60 s after its
// page closes (message content leaves memory soon, FR-085). An action sends the item's version tag
// in `If-Match`; on success the item's detail is removed and the lists invalidated, on `404` the
// same, on `412` the detail and lists are read again. Every mutation runs through the mutation cache,
// so session reactions apply (a refused flag refreshes the identity, FR-004). Downloads go through the
// client with `parseAs: 'blob'`, so a refusal is an ApiProblem with a translated reason (R10).
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type ListMeta,
  type QuarantineActionReport,
  type QuarantineBulkActionRequest,
  type QuarantineBulkResult,
  type QuarantineItem,
  type QuarantineItemDetails,
  type QuarantineListParams,
  type QuarantineSettings,
} from '@/api'
import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

export { fetchQuarantineCapabilities, quarantineCapabilitiesOptions } from './capabilities'

export const QUARANTINE_STALE_TIME = 30_000
/** An item's content is dropped from memory a minute after its page closed (FR-085). */
export const ITEM_GC_TIME = 60_000

export interface QuarantinePage {
  data: QuarantineItem[]
  meta: ListMeta
}

// ---------------------------------------------------------------------------------------------
// Queries

/** The quarantine settings (the public subset for domain administrators and mailbox users). */
export async function fetchQuarantineSettings(): Promise<QuarantineSettings> {
  return requireData(await api.GET('/quarantine/settings')).data
}

export function quarantineSettingsOptions() {
  return queryOptions({
    queryKey: queryKeys.quarantine.settings(),
    queryFn: fetchQuarantineSettings,
    staleTime: QUARANTINE_STALE_TIME,
  })
}

export async function fetchQuarantineItems(params: QuarantineListParams): Promise<QuarantinePage> {
  return requireData(await api.GET('/quarantine', { params: { query: params } }))
}

export function quarantineListOptions(params: QuarantineListParams) {
  return queryOptions({
    queryKey: queryKeys.quarantine.list(params),
    queryFn: () => fetchQuarantineItems(params),
    staleTime: QUARANTINE_STALE_TIME,
  })
}

export async function fetchQuarantineItem(itemId: number): Promise<QuarantineItemDetails> {
  return requireData(await api.GET('/quarantine/{itemId}', { params: { path: { itemId } } })).data
}

export function quarantineItemOptions(itemId: number) {
  return queryOptions({
    queryKey: queryKeys.quarantine.detail(itemId),
    queryFn: () => fetchQuarantineItem(itemId),
    staleTime: QUARANTINE_STALE_TIME,
    gcTime: ITEM_GC_TIME,
  })
}

/**
 * Whether a recipient has a mailbox page (FR-006, research R13): UI 003's mailbox read under its
 * own key, so the mailbox page finds it cached. A resource or a deleted mailbox answers `404`.
 */
export function recipientMailboxOptions(address: string) {
  return queryOptions({
    queryKey: queryKeys.mailboxes.detail(address),
    queryFn: async () =>
      requireData(await api.GET('/mailboxes/{mailbox}', { params: { path: { mailbox: address } } }))
        .data,
    staleTime: QUARANTINE_STALE_TIME,
    retry: false,
  })
}

/** The domains of an administrator's scope for the domain filter, searched by the server. */
export function quarantineDomainSource(): DomainPickerSource {
  return {
    id: 'domains',
    queryKey: (q) => [...queryKeys.domains.lists(), 'quarantine-picker', { q }],
    fetchPage: async ({ q, offset, limit }) => {
      const page = requireData(
        await api.GET('/domains', {
          params: { query: { sort: 'name', order: 'asc', limit, offset, ...(q ? { q } : {}) } },
        }),
      )
      return {
        items: page.data.map((domain) => ({ name: domain.name, nameUnicode: domain.unicodeName })),
        total: page.meta.total,
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Item actions

/** An action on one item; `releaseWithoutLearning` is legacy's quick release ("Release"). */
export type ItemActionKind = 'release' | 'releaseWithoutLearning' | 'learnAsSpam' | 'delete'

/** What an action needs of the item: its identifier and its version tag as last read. */
export type ItemRef = Pick<QuarantineItem, 'id' | 'etag'>

function invalidateLists(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.quarantine.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

/** The item is gone (done elsewhere or here): its detail is dropped and the lists refreshed. */
export function forgetItem(client: QueryClient, itemId: number): Promise<unknown> {
  client.removeQueries({ queryKey: queryKeys.quarantine.detail(itemId) })
  return invalidateLists(client)
}

async function sendItemAction(
  kind: ItemActionKind,
  item: ItemRef,
): Promise<QuarantineActionReport | null> {
  const params = { path: { itemId: item.id }, header: { 'If-Match': item.etag } }
  switch (kind) {
    case 'delete':
      // Problem answers are thrown by the client's middleware.
      await api.DELETE('/quarantine/{itemId}', { params })
      return null
    case 'learnAsSpam':
      return requireData(await api.POST('/quarantine/{itemId}/spam-learning', { params })).data
    default:
      return requireData(
        await api.POST('/quarantine/{itemId}/release', {
          params,
          body: { learnAsHam: kind === 'release' },
        }),
      ).data
  }
}

/**
 * Runs one action (never repeated, FR-031). Success and `404` drop the item's detail and refresh
 * the lists; `412` reads the item again. The caller re-reads the item after a lost response.
 */
export function runItemAction(
  client: QueryClient,
  kind: ItemActionKind,
  item: ItemRef,
): Promise<QuarantineActionReport | null> {
  return runMutation<QuarantineActionReport | null, void>(
    client,
    {
      mutationFn: () => sendItemAction(kind, item),
      onSuccess: () => forgetItem(client, item.id),
      onError: (error) => {
        if (!isApiProblem(error)) return
        if (error.status === 404) void forgetItem(client, item.id)
        else if (error.status === 412) {
          // A list action must receive the current row/tag before the user confirms again too.
          return Promise.all([
            client.invalidateQueries({ queryKey: queryKeys.quarantine.detail(item.id) }),
            invalidateLists(client),
          ])
        }
      },
    },
    undefined,
  )
}

/**
 * One bulk request (US2, research R15). The details of items that are done or gone are dropped and
 * the lists refreshed, also after a lost connection, so the user sees what happened. Never resent.
 */
export function applyQuarantineBulk(
  client: QueryClient,
  request: QuarantineBulkActionRequest,
): Promise<QuarantineBulkResult> {
  return runMutation<QuarantineBulkResult, QuarantineBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/quarantine/bulk-actions', { body })).data,
      onSuccess: async (result) => {
        for (const item of result.results) {
          if (item.outcome === 'done' || item.outcome === 'notFound') {
            client.removeQueries({ queryKey: queryKeys.quarantine.detail(Number(item.id)) })
          }
        }
        await invalidateLists(client)
      },
      onError: async (error) => {
        if (isApiProblem(error) && error.kind === 'network') await invalidateLists(client)
      },
    },
    request,
  )
}

// ---------------------------------------------------------------------------------------------
// Downloads (fetchers for `saveApiFile`)

export function fetchMessageFile(itemId: number) {
  return api.GET('/quarantine/{itemId}/message', {
    params: { path: { itemId } },
    parseAs: 'blob',
  })
}

export function fetchAttachmentFile(itemId: number, position: number) {
  return api.GET('/quarantine/{itemId}/attachments/{position}', {
    params: { path: { itemId, position } },
    parseAs: 'blob',
  })
}
