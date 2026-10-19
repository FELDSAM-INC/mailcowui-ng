// The DNS capabilities (research R4): defaults and limits of every DKIM, MTA-STS and diagnostics
// form, and the server switches for private key export and DNS publication. Never hard-coded
// (conventions "Where features meet"). One query, fresh for five minutes; refreshed when a problem
// says that the settings changed (`forbidden`, export or publication turned off), so the actions
// follow the server at once.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'

import { api, isApiProblem, queryKeys, requireData, type DnsCapabilities } from '@/api'

const REFRESHING_PROBLEMS = [
  'forbidden',
  'dkim-private-key-export-disabled',
  'dkim-dns-publication-disabled',
] as const

export async function fetchDnsCapabilities(): Promise<DnsCapabilities> {
  return requireData(await api.GET('/capabilities/dns')).data
}

export function dnsCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.dns.capabilities(),
    queryFn: fetchDnsCapabilities,
    staleTime: 300_000,
    gcTime: 300_000,
  })
}

/** Invalidates the capabilities after a problem that means the settings changed. */
export function refreshCapabilitiesOn(error: unknown, client: QueryClient): boolean {
  if (!isApiProblem(error) || !REFRESHING_PROBLEMS.some((name) => error.is(name))) return false
  void client.invalidateQueries({ queryKey: queryKeys.dns.capabilities() })
  return true
}

const watched = new WeakSet<QueryClient>()

/** Refreshes the capabilities after every failed query or mutation of the client (once each). */
export function watchCapabilityProblems(client: QueryClient): void {
  if (watched.has(client)) return
  watched.add(client)
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      refreshCapabilitiesOn(event.action.error, client)
    }
  })
  client.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      refreshCapabilitiesOn(event.action.error, client)
    }
  })
}

export function useDnsCapabilities() {
  const client = useQueryClient()
  watchCapabilityProblems(client)
  return useQuery(dnsCapabilitiesOptions())
}

/** Private key export is on (`null` for domain administrators means never). */
export function exportEnabled(caps: Pick<DnsCapabilities, 'dkim'> | undefined): boolean {
  return caps?.dkim.privateKeyExportEnabled === true
}
