// The DNS capabilities read (T010, research R4): one query, five minutes fresh, refreshed after the
// problems that mean the server settings changed, and a failed read that offers a retry without
// blocking the screens that do not need it.
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, queryKeys } from '@/api'
import {
  dnsCapabilitiesOptions,
  exportEnabled,
  refreshCapabilitiesOn,
  useDnsCapabilities,
  watchCapabilityProblems,
} from '@/features/dns/api/capabilities'

import { server } from '../../../mocks/node'
import { withSetup } from '../../support/composable'

const problem = (name: string, status = 403) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status })

describe('DNS capabilities', () => {
  it('is one query keyed dns-capabilities, fresh for five minutes', () => {
    const options = dnsCapabilitiesOptions()
    expect(options.queryKey).toEqual(queryKeys.dns.capabilities())
    expect(options.staleTime).toBe(300_000)
    expect(options.gcTime).toBe(300_000)
  })

  it.each(['forbidden', 'dkim-private-key-export-disabled', 'dkim-dns-publication-disabled'])(
    'is refreshed after %s',
    (name) => {
      const client = new QueryClient()
      client.setQueryData(queryKeys.dns.capabilities(), { serverHostname: 'x' })
      expect(refreshCapabilitiesOn(problem(name), client)).toBe(true)
      expect(client.getQueryState(queryKeys.dns.capabilities())?.isInvalidated).toBe(true)
    },
  )

  it('ignores other problems and other errors', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.dns.capabilities(), { serverHostname: 'x' })
    expect(refreshCapabilitiesOn(problem('dkim-key-exists', 409), client)).toBe(false)
    expect(refreshCapabilitiesOn(new Error('x'), client)).toBe(false)
    expect(client.getQueryState(queryKeys.dns.capabilities())?.isInvalidated).toBe(false)
  })

  it('watches failed queries and mutations of the client once', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(queryKeys.dns.capabilities(), { serverHostname: 'x' })
    watchCapabilityProblems(client)
    watchCapabilityProblems(client)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await client
      .fetchQuery({
        queryKey: ['dkim-keys', 'detail', 'x'],
        queryFn: () => Promise.reject(problem('forbidden')),
      })
      .catch(() => undefined)
    expect(invalidate).toHaveBeenCalledTimes(1)
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(problem('dkim-dns-publication-disabled')) })
      .execute(undefined)
      .catch(() => undefined)
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('treats a missing export setting (domain administrators) as never', () => {
    expect(exportEnabled(undefined)).toBe(false)
    expect(
      exportEnabled({ dkim: { privateKeyExportEnabled: null } } as Parameters<
        typeof exportEnabled
      >[0]),
    ).toBe(false)
    expect(
      exportEnabled({ dkim: { privateKeyExportEnabled: true } } as Parameters<
        typeof exportEnabled
      >[0]),
    ).toBe(true)
  })

  it('exposes a failed read with a retry', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v2/capabilities/dns', () => {
        calls += 1
        return HttpResponse.json(
          { type: 'about:blank', title: 'x', status: 500, requestId: 'a'.repeat(32) },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }),
    )
    const { result, unmount } = withSetup(() => useDnsCapabilities())
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    await result.refetch()
    await flushPromises()
    expect(calls).toBe(2)
    unmount()
  })
})
