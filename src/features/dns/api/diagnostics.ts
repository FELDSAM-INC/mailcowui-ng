// DNS diagnostics runs (research R14, data-model §3, FR-058). A run is a query per name, kept and
// fresh for ten minutes: opening the page starts one only without a fresh result, and "Run again"
// refetches. It is never retried, and it does not take TanStack's signal, so leaving the page does
// not abort it (the result is kept for its own name). Its own timer aborts it after
// `runTimeoutSeconds + 15` seconds (setTimeout, so tests can drive it). Every answer's
// `RateLimit-*` headers, or a 429's `retryAfter`, are stored in the cache next to the results, so
// sign-out (`queryClient.clear()`) drops both.
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import { api, isApiProblem, queryKeys, type DnsDiagnosticsResult } from '@/api'

import {
  rateLimitFromHeaders,
  rateLimitFromProblem,
  type RateLimitState,
} from '../diagnostics/rate-limit'

export const DIAGNOSTICS_FRESH_MS = 600_000

/** A result and when it arrived. */
export interface DiagnosticsEntry {
  result: DnsDiagnosticsResult
  receivedAt: number
}

/** Written by key and policy changes in this app (`markDnsChanged`). */
export interface ChangedMarker {
  changedAt: number
}

/** The run took longer than the server's run time limit plus a margin. */
export class DiagnosticsTimeout extends Error {
  constructor(readonly seconds: number) {
    super(`DNS diagnostics did not answer within ${seconds} s`)
  }
}

export function isDiagnosticsTimeout(error: unknown): error is DiagnosticsTimeout {
  return error instanceof DiagnosticsTimeout
}

/** The client-side time limit: the server's run time limit plus 15 seconds. */
export const clientTimeoutSeconds = (runTimeoutSeconds: number) => runTimeoutSeconds + 15

function storeRateLimit(client: QueryClient, state: RateLimitState | null) {
  if (state) client.setQueryData(queryKeys.dnsDiagnostics.rateLimit(), state)
}

export async function runDiagnostics(
  client: QueryClient,
  name: string,
  runTimeoutSeconds: number,
): Promise<DiagnosticsEntry> {
  const seconds = clientTimeoutSeconds(runTimeoutSeconds)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), seconds * 1000)
  try {
    const { data, response } = await api.GET('/dns-diagnostics/{diagnosticsName}', {
      params: { path: { diagnosticsName: name } },
      signal: controller.signal,
    })
    storeRateLimit(client, rateLimitFromHeaders(response.headers))
    if (!data) throw new DiagnosticsTimeout(seconds)
    return { result: data.data, receivedAt: Date.now() }
  } catch (error) {
    if (controller.signal.aborted) throw new DiagnosticsTimeout(seconds)
    if (isApiProblem(error)) {
      const limit = client.getQueryData<RateLimitState>(queryKeys.dnsDiagnostics.rateLimit())
      storeRateLimit(client, rateLimitFromProblem(error, limit?.limit ?? 10))
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function diagnosticsOptions(client: QueryClient, name: string, runTimeoutSeconds: number) {
  return queryOptions({
    queryKey: queryKeys.dnsDiagnostics.result(name),
    // TanStack's signal is deliberately not used (R14).
    queryFn: () => runDiagnostics(client, name, runTimeoutSeconds),
    staleTime: DIAGNOSTICS_FRESH_MS,
    gcTime: DIAGNOSTICS_FRESH_MS,
    retry: false,
  })
}

/** Whether a key or policy of the name changed in this app after the result arrived. */
export function changedAfter(
  entry: DiagnosticsEntry | undefined,
  marker: ChangedMarker | undefined,
): boolean {
  return !!entry && !!marker && marker.changedAt > entry.receivedAt
}
