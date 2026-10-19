// Requests that carry a private key (T080, research R11, R12, FR-076, FR-077): direct client calls,
// never a query or mutation of the cache; only the non-secret change result is written to the
// entry's detail.
import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'

import { ApiProblem, queryKeys } from '@/api'
import { exportKey, importKey } from '@/features/dns/api/dkim-secrets'

import { useScenario } from '../../../mocks/node'
import { DNS_PEM_FIXTURES } from '../../../mocks/scenarios/dns'

function cacheText(client: QueryClient): string {
  return JSON.stringify([
    client
      .getQueryCache()
      .getAll()
      .map((query) => [query.queryKey, query.state.data]),
    client
      .getMutationCache()
      .getAll()
      .map((mutation) => mutation.state.variables),
  ])
}

describe('dkim secrets', () => {
  it('imports with a direct call and writes only the result to the detail', async () => {
    useScenario('dns-admin')
    const client = new QueryClient()
    const result = await importKey(client, 'example.net', {
      privateKey: DNS_PEM_FIXTURES.pkcs8,
      selector: 'mx2024',
      overwrite: false,
    })
    expect(result.key?.selector).toBe('mx2024')
    expect(client.getQueryData(queryKeys.dkimKeys.detail('example.net'))).toMatchObject({
      name: 'example.net',
      state: 'valid',
    })
    expect(client.getMutationCache().getAll()).toHaveLength(0)
    expect(cacheText(client)).not.toContain('PRIVATE KEY')
  })

  it('leaves no key text in the caches after a refusal', async () => {
    useScenario('dns-admin')
    const client = new QueryClient()
    const refused = await importKey(client, 'example.net', {
      privateKey: DNS_PEM_FIXTURES.ec,
      selector: 'dkim',
      overwrite: false,
    }).catch((error: unknown) => error)
    expect(refused).toBeInstanceOf(ApiProblem)
    expect((refused as ApiProblem).fieldErrors.get('privateKey')?.[0]?.code).toBe(
      'unsupportedKeyType',
    )
    expect(cacheText(client)).not.toContain('PRIVATE KEY')
  })

  it('sends If-Match when overwriting', async () => {
    const state = useScenario('dns-admin')
    const client = new QueryClient()
    await importKey(
      client,
      'example.org',
      { privateKey: DNS_PEM_FIXTURES.pkcs8, selector: 'dkim', overwrite: true },
      '"stale"',
    ).catch(() => undefined)
    const sent = state.requests.find((request) => request.operationId === 'importDkimKey')
    expect(sent?.headers['if-match']).toBe('"stale"')
  })

  it('exports with a direct call that nothing caches', async () => {
    useScenario('dns-admin-fork')
    const key = await exportKey('example.org')
    expect(key.privateKey).toContain('PRIVATE KEY')
    expect(key.selector).toBe('dkim')
  })
})
