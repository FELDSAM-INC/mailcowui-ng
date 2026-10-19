// The dashboard's data layer (data-model §3, research R5, R8, R9, R10). Only the queries under
// `['monitoring', 'live', …]` poll, at the interval the live-update controller gives (false unless
// it runs), never in the background and without retries (the next tick is the retry). The version
// and the update status are read once per visit; the public addresses only on demand. Container
// actions run through the query client's mutation cache, so their outcome arrives even after the
// dashboard was left.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isAuditRecorded,
  queryKeys,
  requireData,
  type Container,
  type ContainerAction,
  type ContainerActionResult,
  type ContainerResourceUsage,
  type HostOverview,
  type InstallationUpdateStatus,
  type InstallationVersion,
  type MailStorageUsage,
  type PublicAddresses,
} from '@/api'
import { LIST_LIMIT_MAX } from '@/shared/validation/limits'

/** The polling interval of a live query: milliseconds, or false. */
export type Interval = () => number | false

const live = (interval: Interval) => ({
  staleTime: 0,
  retry: false as const,
  refetchInterval: interval(),
  refetchIntervalInBackground: false,
})

export function useHostOverview(interval: Interval) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.monitoring.host(),
      queryFn: async (): Promise<HostOverview> => requireData(await api.GET('/host')).data,
      ...live(interval),
    })),
  )
}

export function useMailStorage(interval: Interval) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.monitoring.mailStorage(),
      queryFn: async (): Promise<MailStorageUsage> =>
        requireData(await api.GET('/host/mail-storage')).data,
      ...live(interval),
    })),
  )
}

export function containersOptions() {
  return queryOptions({
    queryKey: queryKeys.monitoring.containers(),
    queryFn: async (): Promise<Container[]> =>
      requireData(
        await api.GET('/containers', {
          params: { query: { limit: LIST_LIMIT_MAX, sort: 'name', order: 'asc' } },
        }),
      ).data,
    staleTime: 0,
    retry: false,
  })
}

/** Every container of the installation (one page of the largest size, sorted by name). */
export function useContainers(interval: Interval = () => false) {
  return useQuery(
    computed(() => ({
      ...containersOptions(),
      refetchInterval: interval(),
      refetchIntervalInBackground: false,
    })),
  )
}

export function useResourceUsage(
  name: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
  interval: Interval,
) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.monitoring.resourceUsage(toValue(name)),
      queryFn: async (): Promise<ContainerResourceUsage> =>
        requireData(
          await api.GET('/containers/{containerName}/resource-usage', {
            params: { path: { containerName: toValue(name) } },
          }),
        ).data,
      enabled: toValue(enabled),
      gcTime: 0,
      ...live(interval),
    })),
  )
}

export function useInstallationVersion() {
  return useQuery({
    queryKey: queryKeys.monitoring.installation(),
    queryFn: async (): Promise<InstallationVersion> =>
      requireData(await api.GET('/installation')).data,
    staleTime: Infinity,
    refetchOnMount: 'always',
  })
}

export function useUpdateStatus() {
  return useQuery({
    queryKey: queryKeys.monitoring.updateStatus(),
    queryFn: async (): Promise<InstallationUpdateStatus> =>
      requireData(await api.GET('/installation/update-status')).data,
    staleTime: Infinity,
    refetchOnMount: 'always',
    retry: false,
  })
}

/** The public addresses, read only on "Show public IP" and forgotten with the dashboard. */
export function usePublicAddresses() {
  return useQuery({
    queryKey: queryKeys.monitoring.publicAddresses(),
    queryFn: async (): Promise<PublicAddresses> =>
      requireData(await api.GET('/host/public-addresses')).data,
    enabled: false,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })
}

export async function fetchContainer(name: string): Promise<Container> {
  return requireData(
    await api.GET('/containers/{containerName}', { params: { path: { containerName: name } } }),
  ).data
}

export interface ContainerActionAnswer {
  result: ContainerActionResult
  auditRecorded: boolean
}

export async function sendContainerAction(
  name: string,
  action: ContainerAction,
): Promise<ContainerActionAnswer> {
  const options = { params: { path: { containerName: name } } }
  const answer =
    action === 'start'
      ? await api.POST('/containers/{containerName}/start', options)
      : action === 'stop'
        ? await api.POST('/containers/{containerName}/stop', options)
        : await api.POST('/containers/{containerName}/restart', options)
  return { result: requireData(answer).data, auditRecorded: isAuditRecorded(answer.response) }
}

/** Writes a container read after an action into the cached list (or adds nothing if absent). */
export function writeContainer(client: QueryClient, container: Container): void {
  client.setQueryData<Container[]>(queryKeys.monitoring.containers(), (list) =>
    list?.map((item) => (item.name === container.name ? container : item)),
  )
}
