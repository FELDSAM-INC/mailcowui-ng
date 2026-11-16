import { queryOptions } from '@tanstack/vue-query'
import { api, requireData, type components, type paths } from '@/api'
export type LegacyKey = components['schemas']['LegacyApiKey']
export type KeyPatch = components['schemas']['LegacyApiKeyPatch']
export type KeyCreate = components['schemas']['LegacyApiKeyCreateRequest']
export type ListParams = NonNullable<paths['/legacy-api-keys']['get']['parameters']['query']>
export const keys = ['legacy-api-keys'] as const
export const detailKey = (id: number) => [...keys, id] as const
export function listOptions(params: ListParams) {
  return queryOptions({
    queryKey: [...keys, 'list', params],
    queryFn: async () =>
      requireData(await api.GET('/legacy-api-keys', { params: { query: params } })),
    staleTime: 30_000,
  })
}
export async function fetchKey(id: number) {
  return requireData(
    await api.GET('/legacy-api-keys/{legacyKeyId}', { params: { path: { legacyKeyId: id } } }),
  ).data
}
export function keyOptions(id: number) {
  return queryOptions({ queryKey: detailKey(id), queryFn: () => fetchKey(id), staleTime: 30_000 })
}
export async function createKey(body: KeyCreate) {
  return requireData(await api.POST('/legacy-api-keys', { body })).data
}
export async function updateKey(id: number, body: KeyPatch, etag: string) {
  return requireData(
    await api.PATCH('/legacy-api-keys/{legacyKeyId}', {
      params: { path: { legacyKeyId: id }, header: { 'If-Match': etag } },
      body,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
}
export async function regenerateKey(id: number, etag: string) {
  return requireData(
    await api.POST('/legacy-api-keys/{legacyKeyId}/regenerate', {
      params: { path: { legacyKeyId: id }, header: { 'If-Match': etag } },
    }),
  ).data
}
export async function deleteKey(id: number, etag: string) {
  await api.DELETE('/legacy-api-keys/{legacyKeyId}', {
    params: { path: { legacyKeyId: id }, header: { 'If-Match': etag } },
  })
}
