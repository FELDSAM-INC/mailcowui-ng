// The spam score and list entry calls and their cache rules (UI 006 data-model §3, research R25).
// A saved score is written from the response; a reset invalidates it. Entries are listed per owner
// (`list` and `ownership` filters); creating and removing invalidate the owner's lists and the lists
// that show its entries read-only: a domain's entries appear in its mailboxes' lists, and a
// mailbox's entries in its domain's list. The audit log is refreshed after every change. Nothing
// refetches on a timer.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type SpamPolicyEntry,
  type SpamPolicyEntryCreateRequest,
  type SpamPolicyEntryListParams,
  type SpamScore,
  type SpamScoreUpdate,
} from '@/api'

import { ownerOperations, type PolicyOwner } from './owner'

export const SPAM_POLICY_STALE_TIME = 30_000

export async function fetchSpamScore(mailbox: string): Promise<SpamScore> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/spam-score', { params: { path: { mailbox } } }),
  ).data
}

export function spamScoreOptions(mailbox: string) {
  return queryOptions({
    queryKey: queryKeys.spamPolicy.spamScore(mailbox),
    queryFn: () => fetchSpamScore(mailbox),
    staleTime: SPAM_POLICY_STALE_TIME,
  })
}

export function useSpamScore(mailbox: MaybeRefOrGetter<string>) {
  return useQuery(computed(() => spamScoreOptions(toValue(mailbox))))
}

const refreshAudit = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })

export function setSpamScore(
  client: QueryClient,
  mailbox: string,
  body: SpamScoreUpdate,
  ifMatch: string,
): Promise<SpamScore> {
  return runMutation<SpamScore, SpamScoreUpdate>(
    client,
    {
      mutationFn: async (update) =>
        requireData(
          await api.PUT('/mailboxes/{mailbox}/spam-score', {
            params: { path: { mailbox }, header: { 'If-Match': ifMatch } },
            body: update,
          }),
        ).data,
      onSuccess: (score) => {
        client.setQueryData(queryKeys.spamPolicy.spamScore(mailbox), score)
        return refreshAudit(client)
      },
    },
    body,
  )
}

export function resetSpamScore(client: QueryClient, mailbox: string, ifMatch: string) {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/spam-score', {
          params: { path: { mailbox }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: () =>
        Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.spamPolicy.spamScore(mailbox) }),
          refreshAudit(client),
        ]),
    },
    undefined,
  )
}

export function entryListOptions(owner: PolicyOwner, params: SpamPolicyEntryListParams) {
  return queryOptions({
    queryKey: queryKeys.spamPolicy.entries(owner.kind, owner.name, params),
    queryFn: () => ownerOperations(owner.kind).list(owner.name, params),
    staleTime: SPAM_POLICY_STALE_TIME,
  })
}

const domainOf = (address: string) => address.slice(address.lastIndexOf('@') + 1).toLowerCase()

/** Whether a cached entry list shows the owner's entries, as its own or read-only. */
function showsEntriesOf(key: readonly unknown[], owner: PolicyOwner): boolean {
  if (key[0] !== 'spam-policy' || key[1] !== 'entries') return false
  const kind = key[2]
  const name = typeof key[3] === 'string' ? key[3] : ''
  const own = owner.name.toLowerCase()
  if (kind === owner.kind && name === own) return true
  if (owner.kind === 'domain') return kind === 'mailbox' && domainOf(name) === own
  if (owner.kind === 'mailbox') return kind === 'domain' && name === domainOf(own)
  return false
}

/** Refreshes the owner's lists and those that show its entries read-only, and the audit log. */
export function invalidateEntries(client: QueryClient, owner: PolicyOwner): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ predicate: (query) => showsEntriesOf(query.queryKey, owner) }),
    refreshAudit(client),
  ])
}

export function createEntry(
  client: QueryClient,
  owner: PolicyOwner,
  body: SpamPolicyEntryCreateRequest,
): Promise<SpamPolicyEntry> {
  return runMutation<SpamPolicyEntry, SpamPolicyEntryCreateRequest>(
    client,
    {
      mutationFn: (request) => ownerOperations(owner.kind).create(owner.name, request),
      onSuccess: () => invalidateEntries(client, owner),
    },
    body,
  )
}

/** Removes one own entry with its version tag; the caller refreshes the lists once per run. */
export function deleteEntry(
  client: QueryClient,
  owner: PolicyOwner,
  entry: SpamPolicyEntry,
): Promise<void> {
  return runMutation<void, void>(
    client,
    { mutationFn: () => ownerOperations(owner.kind).remove(owner.name, entry.id, entry.etag) },
    undefined,
  )
}
