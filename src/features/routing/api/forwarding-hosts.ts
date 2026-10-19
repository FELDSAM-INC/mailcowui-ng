// The forwarding host data layer (research R17, data-model §3): the list, creation (`201` or
// `200` with every stored address and its outcome), deletion by the stored address (percent-encoded
// by the client's path serialiser) and bulk actions, each invalidating the `forwarding-hosts` root.
import type { QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type ForwardingHost,
  type ForwardingHostBulkActionRequest,
  type ForwardingHostCreateRequest,
  type ForwardingHostCreationResult,
  type ForwardingHostListParams,
} from '@/api'

import { invalidate, type Page } from './common'

export async function fetchForwardingHosts(
  params: ForwardingHostListParams,
): Promise<Page<ForwardingHost>> {
  return requireData(await api.GET('/forwarding-hosts', { params: { query: params } }))
}

export function createForwardingHost(
  client: QueryClient,
  body: ForwardingHostCreateRequest,
): Promise<ForwardingHostCreationResult> {
  return runMutation<ForwardingHostCreationResult, ForwardingHostCreateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/forwarding-hosts', { body: request })).data,
      onSuccess: () => invalidate(client, queryKeys.forwardingHosts.all()),
    },
    body,
  )
}

export function deleteForwardingHost(
  client: QueryClient,
  address: string,
  ifMatch: string,
): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/forwarding-hosts/{forwardingHostAddress}', {
          params: { path: { forwardingHostAddress: address }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () => invalidate(client, queryKeys.forwardingHosts.all()),
      onError: () => invalidate(client, queryKeys.forwardingHosts.all()),
    },
    undefined,
  )
}

export function applyForwardingHostBulkAction(
  client: QueryClient,
  request: ForwardingHostBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, ForwardingHostBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/forwarding-hosts/bulk-actions', { body })).data,
      onSuccess: () => invalidate(client, queryKeys.forwardingHosts.all()),
    },
    request,
  )
}
