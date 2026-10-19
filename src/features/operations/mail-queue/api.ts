// The mail queue data layer (UI 011 research R14, R15, data-model §3). The list is keyed by its
// address parameters (30 s fresh) and refreshed after every action; the delete-all dialog reads the
// counts when it opens; a message's content is fetched when the viewer opens and removed from the
// cache when it closes (`gcTime` 0). Actions are sent once and never repeated: the caller reports
// the outcome, including "outcome unknown".
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  isAuditRecorded,
  requireData,
  type BulkResult,
  type MailQueueActionResult,
  type MailQueueBulkRequest,
  type MailQueueListMeta,
  type MailQueueListParams,
  type MailQueueMessage,
  type MailQueueMessageContent,
} from '@/api'
import { operationsKeys } from '../query-keys'

export interface MailQueuePage {
  data: MailQueueMessage[]
  meta: MailQueueListMeta
}

export type QueueAction = MailQueueBulkRequest['action']

/** An action's result with whether its audit record was written (`Audit-Recorded`). */
export interface Recorded<T> {
  result: T
  auditRecorded: boolean
}

export function mailQueueListOptions(params: MailQueueListParams) {
  return queryOptions({
    queryKey: operationsKeys.mailQueue.list(params),
    queryFn: async (): Promise<MailQueuePage> =>
      requireData(await api.GET('/mail-queue/messages', { params: { query: params } })),
    staleTime: 30_000,
  })
}

/** The queue's size, read when the delete-all dialog opens (FR-058). */
export function mailQueueCountsOptions() {
  return queryOptions({
    queryKey: operationsKeys.mailQueue.counts(),
    queryFn: async (): Promise<MailQueueListMeta['queueCounts']> =>
      requireData(await api.GET('/mail-queue/messages', { params: { query: { limit: 1 } } })).meta
        .queueCounts,
    staleTime: 0,
    gcTime: 0,
  })
}

/** A message's content, never kept after the viewer closes (clarification, FR-061). */
export function mailQueueContentOptions(queueId: string) {
  return queryOptions({
    queryKey: operationsKeys.mailQueue.content(queueId),
    queryFn: async (): Promise<MailQueueMessageContent> =>
      requireData(
        await api.GET('/mail-queue/messages/{queueId}/content', {
          params: { path: { queueId } },
        }),
      ).data,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}

export async function runQueueAction(
  action: QueueAction,
  ids: readonly string[],
): Promise<Recorded<BulkResult>> {
  const result = await api.POST('/mail-queue/messages/bulk-actions', {
    body: { action, targets: ids.map((id) => ({ id })) },
  })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export async function flushMailQueue(): Promise<Recorded<MailQueueActionResult>> {
  const result = await api.POST('/mail-queue/flush')
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export async function purgeMailQueue(): Promise<Recorded<MailQueueActionResult>> {
  const result = await api.POST('/mail-queue/purge')
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

/** After any action (and after an unknown outcome): the list and the counts are read again. */
export function refreshQueue(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: operationsKeys.mailQueue.lists() })
}

/** A message that left the queue: drop it from every cached list page (edge case). */
export function forgetQueuedMessage(client: QueryClient, queueId: string): void {
  client.setQueriesData<MailQueuePage>({ queryKey: operationsKeys.mailQueue.lists() }, (page) =>
    page ? { ...page, data: page.data.filter((message) => message.id !== queueId) } : page,
  )
}
