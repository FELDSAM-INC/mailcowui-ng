// The mailbox data layer (research R5, R16, data-model §3). Queries are keyed under
// `['mailboxes', …]`, so one prefix invalidates everything that depends on mailboxes. Mutations run
// through the query client's mutation cache, so the session reactions apply to them too; they
// patch the caches they can and invalidate the rest, the audit log included. Requests that carry a
// password never go through TanStack Query (conventions "Secrets in requests or responses"): the
// caller sends them with `useSecretRequest` and applies the same cache rules with the response.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  type BulkResult,
  type MailboxBulkActionRequest,
  queryKeys,
  requireData,
  runMutation,
  type ListMeta,
  type MailboxCapabilities,
  type MailboxCreateRequest,
  type MailboxListParams,
  type MailboxRenameRequest,
  type MailboxTagParams,
  type Writable,
} from '@/api'
import { captureSessionScope } from '@/api/session-scope'

import type { DomainPickerSource } from '@/shared/components/DomainPicker.vue'

import type { Patch } from './patch'
import type { Mailbox, MailboxCreated, MailboxDeletionPreview, MailboxRenamed } from './types'

export interface MailboxPage {
  data: Mailbox[]
  meta: ListMeta
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

// Queries

export async function fetchMailboxes(params: MailboxListParams): Promise<MailboxPage> {
  return requireData(await api.GET('/mailboxes', { params: { query: params } }))
}

export function mailboxListOptions(params: MailboxListParams) {
  return queryOptions({
    queryKey: queryKeys.mailboxes.list(params),
    queryFn: () => fetchMailboxes(params),
    staleTime: 30_000,
  })
}

/**
 * The domains of the caller's scope for a domain picker (the list's domain filter, the new
 * mailbox's domain): searched by the server, sorted by name. `relay` marks relayed domains.
 */
export function domainPickerSource(): DomainPickerSource {
  return {
    id: 'domains',
    queryKey: (q) => [...queryKeys.domains.lists(), 'picker', { q }],
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

export async function fetchMailbox(address: string): Promise<Mailbox> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}', { params: { path: { mailbox: address } } }),
  ).data
}

/** A mailbox from a cached list page, found by its address in any letter case. */
export function cachedMailbox(client: QueryClient, address: string): Mailbox | undefined {
  const wanted = address.toLowerCase()
  for (const [, page] of client.getQueriesData<MailboxPage>({
    queryKey: queryKeys.mailboxes.lists(),
  })) {
    const mailbox = page?.data.find((item) => item.address === wanted)
    if (mailbox) return mailbox
  }
  return undefined
}

/**
 * The mailbox page's query. A mailbox opened from the list shows at once from the list entry and is
 * refetched right away (`initialDataUpdatedAt: 0`, FR-017).
 */
export function mailboxOptions(client: QueryClient, address: string) {
  return queryOptions({
    queryKey: queryKeys.mailboxes.detail(address),
    queryFn: () => fetchMailbox(address),
    staleTime: 30_000,
    initialData: () => cachedMailbox(client, address),
    initialDataUpdatedAt: () => (cachedMailbox(client, address) ? 0 : undefined),
  })
}

export function useMailbox(address: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  return useQuery(computed(() => mailboxOptions(client, toValue(address))))
}

export function capabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.mailboxes.capabilities(),
    queryFn: async (): Promise<MailboxCapabilities> =>
      requireData(await api.GET('/capabilities/mailboxes')).data,
    staleTime: 300_000,
  })
}

export function tagsOptions(params: MailboxTagParams) {
  return queryOptions({
    queryKey: queryKeys.mailboxes.tags(params),
    queryFn: async () => requireData(await api.GET('/mailbox-tags', { params: { query: params } })),
    staleTime: 30_000,
  })
}

export { passwordPolicyOptions } from '@/shared/composables/usePasswordPolicy'

// Cache rules shared by the mutations

function invalidateAudit(client: QueryClient) {
  return client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

/** Writes a mailbox to its detail and to every cached list page that holds it. */
export function writeMailbox(client: QueryClient, mailbox: Mailbox): void {
  client.setQueryData(queryKeys.mailboxes.detail(mailbox.address), mailbox)
  client.setQueriesData<MailboxPage>({ queryKey: queryKeys.mailboxes.lists() }, (page) =>
    page
      ? {
          ...page,
          data: page.data.map((item) => (item.address === mailbox.address ? mailbox : item)),
        }
      : page,
  )
}

/** A mailbox that no longer exists or left the scope: remove its caches, refresh the lists. */
export function forgetMailbox(client: QueryClient, address: string): void {
  client.removeQueries({ queryKey: queryKeys.mailboxes.detail(address) })
  client.removeQueries({ queryKey: queryKeys.mailboxes.deletionPreview(address) })
  void client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() })
}

/** After a change: lists, tags when sent, the domain when its figures moved, the audit log. */
export async function afterMailboxChange(
  client: QueryClient,
  mailbox: Mailbox,
  sent: Patch,
): Promise<void> {
  writeMailbox(client, mailbox)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.searches() }),
    'tags' in sent
      ? client.invalidateQueries({ queryKey: queryKeys.mailboxes.tagLists() })
      : Promise.resolve(),
    'quota' in sent || 'status' in sent
      ? client.invalidateQueries({ queryKey: queryKeys.domains.all() })
      : Promise.resolve(),
    invalidateAudit(client),
  ])
}

function onMailboxError(client: QueryClient, address: string, error: unknown): void {
  if (!isApiProblem(error)) return
  if (error.is('attribute-not-permitted') || error.is('permission-flag-required')) {
    void client.invalidateQueries({ queryKey: queryKeys.identity() })
    void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(address) })
  }
  if (error.status === 404) forgetMailbox(client, address)
}

/** The PATCH itself, for the mutation and for `useSecretRequest` (a change with a password). */
export async function sendMailboxPatch(
  address: string,
  patch: Patch,
  ifMatch: string,
): Promise<Mailbox> {
  return requireData(
    await api.PATCH('/mailboxes/{mailbox}', {
      params: { path: { mailbox: address }, header: { 'If-Match': ifMatch } },
      body: patch,
      headers: MERGE_PATCH,
    }),
  ).data
}

/** A change without a password, through the mutation cache. */
export function updateMailbox(
  client: QueryClient,
  address: string,
  patch: Patch,
  ifMatch: string,
): Promise<Mailbox> {
  return runMutation<Mailbox, Patch>(
    client,
    {
      mutationFn: (body) => sendMailboxPatch(address, body, ifMatch),
      onSuccess: (mailbox, body) => afterMailboxChange(client, mailbox, body),
      onError: (error) => onMailboxError(client, address, error),
    },
    patch,
  )
}

/**
 * A change that carries a password, sent directly (never cached); the response is then written to
 * the caches like any other change. Refusals get the same reactions.
 */
export async function updateMailboxWithPassword(
  client: QueryClient,
  address: string,
  patch: Patch,
  ifMatch: string,
): Promise<Mailbox> {
  const scope = captureSessionScope()
  try {
    const mailbox = await scope.run(() => sendMailboxPatch(address, patch, ifMatch))
    await scope.run(() => afterMailboxChange(client, mailbox, patch))
    return mailbox
  } catch (error) {
    scope.assertCurrent()
    onMailboxError(client, address, error)
    throw error
  }
}

// Deletion (US4, data-model §3, §7.2)

/** A fresh deletion preview: read when the confirmation opens, never kept (FR-044). */
export function deletionPreviewOptions(address: string) {
  return queryOptions({
    queryKey: queryKeys.mailboxes.deletionPreview(address),
    queryFn: async (): Promise<MailboxDeletionPreview> =>
      requireData(
        await api.GET('/mailboxes/{mailbox}/deletion-preview', {
          params: { path: { mailbox: address } },
        }),
      ).data,
    staleTime: 0,
    gcTime: 0,
  })
}

export function fetchDeletionPreview(
  client: QueryClient,
  address: string,
): Promise<MailboxDeletionPreview> {
  return client.fetchQuery(deletionPreviewOptions(address))
}

/** Deletes a mailbox with the preview's version; the lists, domains and audit log follow. */
export function deleteMailbox(client: QueryClient, address: string, ifMatch: string) {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        // Problem answers are thrown by the client's middleware.
        await api.DELETE('/mailboxes/{mailbox}', {
          params: { path: { mailbox: address }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        forgetMailbox(client, address)
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.mailboxes.searches() }),
          client.invalidateQueries({ queryKey: queryKeys.mailboxes.tagLists() }),
          client.invalidateQueries({ queryKey: queryKeys.domains.all() }),
          invalidateAudit(client),
        ])
      },
      onError: (error) => {
        if (isApiProblem(error) && error.status === 404) forgetMailbox(client, address)
      },
    },
    undefined,
  )
}

// Rename (US8, data-model §3)

/**
 * Renames a mailbox with its version: the old detail is removed, the new one written, and the
 * lists, searches, domains and audit log refreshed. After an incomplete or unknown outcome both
 * addresses are read again.
 */
export function renameMailbox(
  client: QueryClient,
  address: string,
  body: MailboxRenameRequest,
  ifMatch: string,
): Promise<MailboxRenamed> {
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() }),
      client.invalidateQueries({ queryKey: queryKeys.mailboxes.searches() }),
      client.invalidateQueries({ queryKey: queryKeys.domains.all() }),
      invalidateAudit(client),
    ])
  return runMutation<MailboxRenamed, MailboxRenameRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(
          await api.POST('/mailboxes/{mailbox}/rename', {
            params: { path: { mailbox: address }, header: { 'If-Match': ifMatch } },
            body: request,
          }),
        ).data,
      onSuccess: async (renamed) => {
        client.removeQueries({ queryKey: queryKeys.mailboxes.detail(address) })
        const { previousAddress: _previous, oldAddressKeptAsAlias: _alias, ...mailbox } = renamed
        writeMailbox(client, mailbox)
        await refresh()
      },
      onError: async (error) => {
        if (!isApiProblem(error)) return
        if (error.status === 404) forgetMailbox(client, address)
        if (error.status === 500 || error.status === 504) {
          const next = `${body.newLocalPart.trim().toLowerCase()}@${address.split('@')[1] ?? ''}`
          await Promise.all([
            client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(address) }),
            client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(next) }),
            refresh(),
          ])
        }
      },
    },
    body,
  )
}

// Bulk actions (US6, data-model §3)

/**
 * One bulk request; whatever its outcome, the lists, searches, domains (status and deletions move
 * their figures) and audit log are refreshed, and the details of deleted or missing mailboxes are
 * removed. A lost connection refreshes the lists too, so the user sees what happened.
 */
export function applyMailboxBulk(
  client: QueryClient,
  request: MailboxBulkActionRequest,
): Promise<BulkResult> {
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() }),
      client.invalidateQueries({ queryKey: queryKeys.mailboxes.searches() }),
      client.invalidateQueries({ queryKey: queryKeys.domains.all() }),
      request.action === 'delete'
        ? client.invalidateQueries({ queryKey: queryKeys.mailboxes.tagLists() })
        : Promise.resolve(),
      invalidateAudit(client),
    ])
  return runMutation<BulkResult, MailboxBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/mailboxes/bulk-actions', { body })).data,
      onSuccess: async (result) => {
        for (const item of result.results) {
          if (
            item.outcome === 'notFound' ||
            (item.outcome === 'done' && request.action === 'delete')
          ) {
            client.removeQueries({ queryKey: queryKeys.mailboxes.detail(item.id.toLowerCase()) })
          } else if (item.outcome === 'done') {
            void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(item.id) })
          }
        }
        await refresh()
      },
      onError: async (error) => {
        if (isApiProblem(error) && error.kind === 'network') await refresh()
      },
    },
    request,
  )
}

// Creation (US2, data-model §3)

/** One domain of the scope, for the add form's quota limits ("max." and no quota left). */
export function domainOptions(name: string) {
  return queryOptions({
    queryKey: queryKeys.domains.detail(name),
    queryFn: async () =>
      requireData(await api.GET('/domains/{domain}', { params: { path: { domain: name } } })).data,
    staleTime: 0,
  })
}

/**
 * Creates a mailbox. The request carries a password, so it is sent directly (never cached,
 * `useSecretRequest`); the new mailbox is written to its detail and the lists, domains, tags and
 * audit log are refreshed.
 */
export async function createMailbox(
  client: QueryClient,
  body: Writable<MailboxCreateRequest>,
): Promise<MailboxCreated> {
  const created = requireData(await api.POST('/mailboxes', { body })).data
  const { creationReport: _report, ...mailbox } = created
  writeMailbox(client, mailbox)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.searches() }),
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.tagLists() }),
    client.invalidateQueries({ queryKey: queryKeys.domains.all() }),
    invalidateAudit(client),
  ])
  return created
}
