// The identity provider data layer (T029, T072, research R14, data-model §3): "not configured" is
// an empty configuration, saves write the secret-free answer to the cache and refresh the public
// configuration, and no query or mutation cache ever holds a typed secret.
import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { ApiProblem, queryKeys } from '@/api'
import {
  capabilitiesOptions,
  configurationOptions,
  deleteIdentityProvider,
  saveIdentityProvider,
  templateNames,
  templatesQuery,
  testIdentityProviderConnection,
  updateIdentityProvider,
} from '@/features/identity-providers/provider/api'
import { formFromDefaults, toInput } from '@/features/identity-providers/provider/form-model'

import { useScenario } from '../../../../mocks/node'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

const SECRET = 'very-secret-bind-password'

function cachedText(): string {
  const queries = client
    .getQueryCache()
    .getAll()
    .map((query) => query.state.data)
  const mutations = client
    .getMutationCache()
    .getAll()
    .map((mutation) => [mutation.state.variables, mutation.state.data])
  return JSON.stringify([queries, mutations])
}

async function ldapForm() {
  const capabilities = await client.fetchQuery(capabilitiesOptions())
  const form = formFromDefaults(capabilities)
  Object.assign(form, {
    type: 'ldap',
    hosts: 'ldap1.example.org',
    baseDn: 'dc=example,dc=org',
    bindDn: 'cn=admin,dc=example,dc=org',
    bindPassword: SECRET,
  })
  return { form, capabilities }
}

describe('identity provider data layer', () => {
  it('reads "not configured" as null and the template names in order', async () => {
    useScenario('idp-none')
    expect(await client.fetchQuery(configurationOptions())).toBeNull()
    expect(templateNames(await client.fetchQuery(templatesQuery()))).toEqual([
      'Default',
      'Staff',
      'Students',
    ])
  })

  it('creates with If-None-Match, caches the answer without the secret, and refreshes', async () => {
    const state = useScenario('idp-none')
    const { form, capabilities } = await ldapForm()
    client.setQueryData(queryKeys.publicConfig(), { stale: true })
    const result = await saveIdentityProvider(client, toInput(form, capabilities.defaults), {
      create: true,
    })
    expect(result.created).toBe(true)
    expect(result.config.type).toBe('ldap')
    expect(client.getQueryData(queryKeys.identityProvider.configuration())).toEqual(result.config)
    expect(client.getQueryState(queryKeys.publicConfig())?.isInvalidated).toBe(true)
    expect(state.requests.at(-1)?.headers['if-none-match']).toBe('*')
    await testIdentityProviderConnection(toInput(form, capabilities.defaults))
    expect(cachedText()).not.toContain(SECRET)
  })

  it('patches with If-Match and removes, leaving no secret in any cache', async () => {
    useScenario('idp-ldap')
    const config = (await client.fetchQuery(configurationOptions()))!
    const saved = await updateIdentityProvider(
      client,
      { bindPassword: SECRET, syncInterval: 30 },
      config.etag,
    )
    expect(saved.type === 'ldap' && saved.syncInterval).toBe(30)
    expect(cachedText()).not.toContain(SECRET)
    await deleteIdentityProvider(client, saved.etag)
    expect(client.getQueryData(queryKeys.identityProvider.configuration())).toBeNull()
  })

  it('rejects an outdated change with a 412 problem', async () => {
    useScenario('idp-changed-elsewhere')
    const config = (await client.fetchQuery(configurationOptions()))!
    await expect(
      updateIdentityProvider(client, { syncInterval: 30 }, config.etag),
    ).rejects.toSatisfy((error) => error instanceof ApiProblem && error.status === 412)
  })
})
