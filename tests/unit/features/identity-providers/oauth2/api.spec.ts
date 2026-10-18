// The OAuth2 client data layer (T084, research R22, data-model §3): query keys and freshness,
// the detail seeded from the list, the cache effects of every change, and secrets that never reach
// a TanStack Query cache (docs/conventions.md "Secrets").
import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { queryKeys, type Oauth2Client } from '@/api'
import {
  bulkOauth2Clients,
  createOauth2Client,
  deleteOauth2Client,
  oauth2CapabilitiesOptions,
  oauth2ClientOptions,
  oauth2ListOptions,
  rememberCreatedClient,
  updateOauth2RedirectUris,
} from '@/features/identity-providers/oauth2/api'

import { useScenario } from '../../../../mocks/node'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

/** Every value of the query and mutation caches, as text. */
function cachedText(): string {
  const queries = client
    .getQueryCache()
    .getAll()
    .map((query) => query.state.data)
  const mutations = client
    .getMutationCache()
    .getAll()
    .map((mutation) => [mutation.state.data, mutation.state.variables])
  return JSON.stringify([queries, mutations])
}

describe('OAuth2 client data layer', () => {
  it('reads the capabilities and a list page under their keys', async () => {
    useScenario('oauth2-many')
    const capabilities = await client.fetchQuery(oauth2CapabilitiesOptions())
    expect(capabilities.bulkLimit).toBe(100)
    expect(oauth2CapabilitiesOptions().queryKey).toEqual(queryKeys.oauth2Clients.capabilities())
    const params = { limit: 25, offset: 0, sort: 'id', order: 'asc' } as const
    const page = await client.fetchQuery(oauth2ListOptions(params))
    expect(page.meta.total).toBe(40)
    expect(oauth2ListOptions(params).queryKey).toEqual(queryKeys.oauth2Clients.list(params))
  })

  it('seeds the client page from a listed entry, then reads it', async () => {
    useScenario('oauth2-many')
    await client.fetchQuery(oauth2ListOptions({ limit: 25, offset: 0 }))
    const options = oauth2ClientOptions(client, 3)
    expect((options.initialData as () => Oauth2Client | undefined)()?.id).toBe(3)
    const fresh = await client.fetchQuery({ ...oauth2ClientOptions(client, 3), staleTime: 0 })
    expect(fresh.redirectUris[0]).toContain('wiki')
  })

  it('keeps the new secret out of every cache after a creation', async () => {
    useScenario('oauth2-empty')
    const created = await createOauth2Client(['https://wiki.example.org/oauth/callback'])
    expect(created.clientSecret).toMatch(/^[0-9a-f]{24}$/)
    const stored = rememberCreatedClient(client, created)
    expect(stored).not.toHaveProperty('clientSecret')
    expect(client.getQueryData(queryKeys.oauth2Clients.detail(created.id))).toEqual(stored)
    expect(cachedText()).not.toContain(created.clientSecret)
  })

  it('keeps renewed secrets out of every cache after a bulk renewal', async () => {
    const state = useScenario('oauth2-bulk-partial')
    const page = await client.fetchQuery(oauth2ListOptions({ limit: 25, offset: 0 }))
    const result = await bulkOauth2Clients(client, {
      action: 'renewSecret',
      targets: page.data.map((entry) => ({ id: String(entry.id), version: entry.etag })),
    })
    const secrets = result.results.map((item) => item.clientSecret)
    expect(secrets.every((secret) => secret && /^[0-9a-f]{24}$/.test(secret))).toBe(true)
    for (const secret of secrets) expect(cachedText()).not.toContain(secret!)
    expect(state.oauth2Clients[0]!.clientSecret).toBe(secrets[0])
  })

  it('writes a changed client to the cache and removes a deleted one', async () => {
    useScenario('oauth2-changed-elsewhere')
    const read = await client.fetchQuery(oauth2ClientOptions(client, 1))
    const saved = await updateOauth2RedirectUris(
      client,
      1,
      ['https://a.example.org/cb', 'https://b.example.org/cb'],
      read.etag,
    )
    expect(client.getQueryData(queryKeys.oauth2Clients.detail(1))).toEqual(saved)
    await deleteOauth2Client(client, 1, saved.etag)
    expect(client.getQueryData(queryKeys.oauth2Clients.detail(1))).toBeUndefined()
  })
})
