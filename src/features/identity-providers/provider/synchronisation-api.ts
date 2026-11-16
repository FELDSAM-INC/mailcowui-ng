import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type components } from '@/api'

export type IdentitySyncStatus = components['schemas']['IdentitySyncStatus']
export type IdentitySyncSettings = components['schemas']['IdentitySyncSettings']
export type IdentitySyncRun = components['schemas']['IdentitySyncRun']
export type IdentityLink = components['schemas']['IdentityLink']
export const identitySyncKey = [...queryKeys.identityProvider.all(), 'synchronisation'] as const

export function synchronisationOptions() {
  return queryOptions({
    queryKey: identitySyncKey,
    queryFn: async () => requireData(await api.GET('/identity-provider/synchronisation')).data,
    staleTime: 15_000,
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => ['pending', 'running'].includes(run.status))
        ? 10_000
        : false,
  })
}

export async function updateSynchronisation(body: Partial<IdentitySyncSettings>, etag: string) {
  return requireData(
    await api.PATCH('/identity-provider/synchronisation', {
      body,
      params: { header: { 'If-Match': etag } },
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
}

export async function requestSyncRun(mode: IdentitySyncRun['mode']) {
  return requireData(
    await api.POST('/identity-provider/synchronisation/runs', {
      body: { mode, ...(mode === 'force' ? { confirmForce: true } : {}) },
    }),
  ).data
}

export async function getIdentityLink(mailbox: string) {
  return requireData(
    await api.GET('/identity-provider/links/{mailbox}', { params: { path: { mailbox } } }),
  ).data
}

export async function deleteIdentityLink(mailbox: string, etag: string) {
  await api.DELETE('/identity-provider/links/{mailbox}', {
    params: { path: { mailbox }, header: { 'If-Match': etag } },
  })
}
