// The relayhost assignment data layer (research R9, data-model §3): the domain's and the
// mailbox's assignment, their replacement with `If-Match`, and the choices of the relayhost
// selectors. A replacement writes the assignment and invalidates what shows it: the relayhost
// lists, details and usage, the domain's or mailbox's detail and list (the assignment is part of
// their version tag, API FR-028) and, for a domain, every cached mailbox assignment.
import type { QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type DomainRelayhostAssignment,
  type MailboxRelayhostAssignment,
  type RelayhostChoice,
} from '@/api'

import { invalidate, type Page } from './common'

export async function fetchDomainAssignment(domain: string): Promise<DomainRelayhostAssignment> {
  return requireData(
    await api.GET('/domains/{domain}/relayhost-assignment', { params: { path: { domain } } }),
  ).data
}

export async function fetchMailboxAssignment(mailbox: string): Promise<MailboxRelayhostAssignment> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/relayhost-assignment', { params: { path: { mailbox } } }),
  ).data
}

export async function fetchRelayhostChoices(params: {
  q: string
  offset: number
  limit: number
}): Promise<Page<RelayhostChoice>> {
  return requireData(
    await api.GET('/relayhost-choices', {
      params: {
        query: {
          ...(params.q ? { q: params.q } : {}),
          offset: params.offset,
          limit: params.limit,
          sort: 'id',
          order: 'asc',
        },
      },
    }),
  )
}

export function replaceDomainAssignment(
  client: QueryClient,
  domain: string,
  relayhostId: number | null,
  ifMatch: string,
): Promise<DomainRelayhostAssignment> {
  return runMutation<DomainRelayhostAssignment, number | null>(
    client,
    {
      mutationFn: async (id) =>
        requireData(
          await api.PUT('/domains/{domain}/relayhost-assignment', {
            params: { path: { domain }, header: { 'If-Match': ifMatch } },
            body: { relayhostId: id },
          }),
        ).data,
      onSuccess: async (assignment) => {
        client.setQueryData(queryKeys.relayhostAssignments.domain(domain), assignment)
        await invalidate(
          client,
          queryKeys.relayhostAssignments.mailboxes(),
          queryKeys.relayhosts.lists(),
          queryKeys.relayhosts.details(),
          queryKeys.relayhosts.usages(),
          queryKeys.domains.detail(assignment.domain),
          queryKeys.domains.lists(),
        )
      },
    },
    relayhostId,
  )
}

export function replaceMailboxAssignment(
  client: QueryClient,
  mailbox: string,
  relayhostId: number | null,
  ifMatch: string,
): Promise<MailboxRelayhostAssignment> {
  return runMutation<MailboxRelayhostAssignment, number | null>(
    client,
    {
      mutationFn: async (id) =>
        requireData(
          await api.PUT('/mailboxes/{mailbox}/relayhost-assignment', {
            params: { path: { mailbox }, header: { 'If-Match': ifMatch } },
            body: { relayhostId: id },
          }),
        ).data,
      onSuccess: async (assignment) => {
        client.setQueryData(queryKeys.relayhostAssignments.mailbox(mailbox), assignment)
        await invalidate(
          client,
          queryKeys.relayhosts.lists(),
          queryKeys.relayhosts.details(),
          queryKeys.relayhosts.usages(),
          queryKeys.mailboxes.detail(assignment.mailbox),
          queryKeys.mailboxes.lists(),
        )
      },
    },
    relayhostId,
  )
}
