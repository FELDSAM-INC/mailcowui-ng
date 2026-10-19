// The diagnostics run (T056, research R14, FR-058): ten minutes fresh, no retry, TanStack's signal
// not passed (leaving the page does not abort), its own timeout of `runTimeoutSeconds + 15` through
// setTimeout, the rate limit from the response, data kept after a failed refetch, everything
// dropped by `clear()`, and the "changed after this check" marker.
import { flushPromises } from '@vue/test-utils'
import { QueryClient, useQuery } from '@tanstack/vue-query'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiProblem, queryKeys } from '@/api'
import {
  changedAfter,
  diagnosticsOptions,
  isDiagnosticsTimeout,
  runDiagnostics,
  type DiagnosticsEntry,
} from '@/features/dns/api/diagnostics'

import { server, useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'
import { withSetup } from '../../support/composable'
import { diagnosticsResult, checkOfStatus } from './diagnostics-fixtures'

const PATH = '*/api/v2/dns-diagnostics/:name'

function serveResult(headers: Record<string, string> = {}) {
  server.use(
    http.get(PATH, () =>
      HttpResponse.json(
        { data: diagnosticsResult([checkOfStatus('match')]) },
        {
          headers: {
            'RateLimit-Limit': '10',
            'RateLimit-Remaining': '7',
            'RateLimit-Reset': '30',
            'Cache-Control': 'no-store',
            ...headers,
          },
        },
      ),
    ),
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('diagnostics query', () => {
  it('is fresh for ten minutes, kept ten minutes and never retried', () => {
    const client = new QueryClient()
    const options = diagnosticsOptions(client, 'example.org', 30)
    expect(options.queryKey).toEqual(queryKeys.dnsDiagnostics.result('example.org'))
    expect(options.staleTime).toBe(600_000)
    expect(options.gcTime).toBe(600_000)
    expect(options.retry).toBe(false)
  })

  it('runs against the mock and stores the rate limit of the response', async () => {
    useScenario('dns-diagnostics-rate-limited')
    const client = new QueryClient()
    const before = Date.now()
    const entry = await runDiagnostics(client, 'example.org', 30)
    expect(entry.result.name).toBe('example.org')
    expect(entry.receivedAt).toBeGreaterThanOrEqual(before)
    const limit = client.getQueryData<{ remaining: number; resetAt: number }>(
      queryKeys.dnsDiagnostics.rateLimit(),
    )
    expect(limit?.remaining).toBe(2)
    expect(limit!.resetAt).toBeGreaterThan(before)
  })

  it('stores a 429 as no runs left until its retryAfter', async () => {
    useScenario('dns-diagnostics-rate-limited')
    const client = new QueryClient()
    for (let run = 0; run < 3; run += 1) await runDiagnostics(client, 'example.org', 30)
    await expect(runDiagnostics(client, 'example.org', 30)).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiProblem && error.status === 429,
    )
    const limit = client.getQueryData<{ remaining: number; resetAt: number }>(
      queryKeys.dnsDiagnostics.rateLimit(),
    )
    expect(limit?.remaining).toBe(0)
    expect(limit!.resetAt).toBeGreaterThan(Date.now())
  })

  it('times out after runTimeoutSeconds + 15 seconds with its own timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.use(
      http.get(PATH, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const client = new QueryClient()
    const run = runDiagnostics(client, 'example.org', 30).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(44_000)
    let settled = false
    void run.then(() => (settled = true))
    await flushPromises()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1_500)
    const error = await run
    expect(isDiagnosticsTimeout(error)).toBe(true)
  })

  it('does not pass the signal of TanStack, so leaving the page does not abort the run', async () => {
    let release!: () => void
    server.use(
      http.get(PATH, async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json(
          { data: diagnosticsResult([checkOfStatus('match')]) },
          {
            headers: {
              'RateLimit-Limit': '10',
              'RateLimit-Remaining': '9',
              'RateLimit-Reset': '60',
              'Cache-Control': 'no-store',
            },
          },
        )
      }),
    )
    const client = testPlugins().queryClient
    const options = diagnosticsOptions(client, 'example.org', 30)
    const { unmount } = withSetup(() => useQuery(options))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    unmount()
    release()
    await vi.waitFor(() =>
      expect(client.getQueryData<DiagnosticsEntry>(options.queryKey)?.result.name).toBe(
        'example.org',
      ),
    )
  })

  it('keeps the previous result when a run fails, and clear() drops results and the rate limit', async () => {
    serveResult()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const options = diagnosticsOptions(client, 'example.org', 30)
    await client.fetchQuery(options)
    server.use(
      http.get(PATH, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'x', status: 500, requestId: 'a'.repeat(32) },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    await client.refetchQueries({ queryKey: options.queryKey })
    expect(client.getQueryState(options.queryKey)?.status).toBe('error')
    expect(client.getQueryData<DiagnosticsEntry>(options.queryKey)?.result.name).toBe('example.org')
    expect(client.getQueryData(queryKeys.dnsDiagnostics.rateLimit())).toBeTruthy()
    client.clear()
    expect(client.getQueryData(options.queryKey)).toBeUndefined()
    expect(client.getQueryData(queryKeys.dnsDiagnostics.rateLimit())).toBeUndefined()
  })

  it('says whether a key or policy changed after the check', () => {
    const entry = { result: diagnosticsResult([]), receivedAt: 1000 }
    expect(changedAfter(entry, { changedAt: 2000 })).toBe(true)
    expect(changedAfter(entry, { changedAt: 500 })).toBe(false)
    expect(changedAfter(entry, undefined)).toBe(false)
    expect(changedAfter(undefined, { changedAt: 2000 })).toBe(false)
  })
})
