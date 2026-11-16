import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type components, type paths, type Writable } from '@/api'

export type MailboxGroup = components['schemas']['MailboxGroup']
export type GroupSummary = components['schemas']['MailboxGroupSummary']
export type GroupPatch = Writable<components['schemas']['MailboxGroupPatch']>
export type GroupCreate = Writable<components['schemas']['MailboxGroupCreateRequest']>
export type GroupListParams = NonNullable<paths['/mailbox-groups']['get']['parameters']['query']>
export const groupKey = [...queryKeys.mailboxes.all(), 'groups'] as const
export const groupDetailKey = (id: number) => [...groupKey, 'detail', id] as const

export function groupListOptions(params: GroupListParams) {
  return queryOptions({
    queryKey: [...groupKey, 'list', params],
    queryFn: async () =>
      requireData(await api.GET('/mailbox-groups', { params: { query: params } })),
    staleTime: 30_000,
  })
}
export function groupOptions(id: number) {
  return queryOptions({
    queryKey: groupDetailKey(id),
    queryFn: () => fetchGroup(id),
    staleTime: 15_000,
  })
}
export async function fetchGroup(id: number) {
  return requireData(
    await api.GET('/mailbox-groups/{groupId}', { params: { path: { groupId: id } } }),
  ).data
}
export async function createGroup(body: GroupCreate) {
  return requireData(await api.POST('/mailbox-groups', { body })).data
}
export async function updateGroup(id: number, body: GroupPatch, etag: string) {
  return requireData(
    await api.PATCH('/mailbox-groups/{groupId}', {
      body,
      params: { path: { groupId: id }, header: { 'If-Match': etag } },
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
}
export async function deleteGroup(id: number, etag: string) {
  return requireData(
    await api.DELETE('/mailbox-groups/{groupId}', {
      params: { path: { groupId: id }, header: { 'If-Match': etag } },
    }),
  ).data
}
export function membershipOptions(mailbox: string) {
  return queryOptions({
    queryKey: [...groupKey, 'memberships', mailbox],
    queryFn: async () =>
      requireData(await api.GET('/mailboxes/{mailbox}/groups', { params: { path: { mailbox } } }))
        .data,
    staleTime: 30_000,
  })
}
