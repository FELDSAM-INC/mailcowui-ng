// The domain data layer (UI 002 T023, research D6, D7, data-model §3): query keys, freshness,
// seeding the detail from the list, and the cache rules of every mutation.
import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { ApiProblem, queryKeys, type Domain } from '@/api'
import {
  applyBulkAction,
  capabilitiesOptions,
  createDomain,
  deleteDomain,
  domainListOptions,
  domainOptions,
  fetchDeletionPreview,
  replaceFooter,
  updateDomain,
} from '@/features/domains/api'
import { createTemplate, deleteTemplate, updateTemplate } from '@/features/domains/templates-api'

import { mockDomain, GIB } from '../../../mocks/factories/domain'
import { useScenario } from '../../../mocks/node'
import { assignDomains } from '../../../mocks/scenarios/domains-base'

let client: QueryClient

function seed(signedInAs = 'admin') {
  const state = useScenario('admin-active', { signedInAs })
  state.domains = [
    mockDomain({ name: 'alpha.example', tags: ['a'] }),
    mockDomain({
      name: 'beta.example',
      usage: {
        mailboxes: 0,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
  ]
  assignDomains(state, 'reseller', ['alpha.example'])
  state.accounts.find((a) => a.username === 'reseller')!.permissions.domainDesc = false
  return state
}

const params = { limit: 25, offset: 0, sort: 'name', order: 'asc' } as const

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

async function loadList() {
  return client.fetchQuery(domainListOptions(params))
}

describe('queries', () => {
  it('keys the list by its parameters and seeds the detail from a cached list entry', async () => {
    seed()
    const list = await loadList()
    expect(client.getQueryData(queryKeys.domains.list(params))).toEqual(list)
    const options = domainOptions(client, 'alpha.example')
    expect(options.queryKey).toEqual(['domains', 'detail', 'alpha.example'])
    expect((options.initialData as () => Domain | undefined)()?.etag).toBe(list.data[0]!.etag)
    const updatedAt = (options.initialDataUpdatedAt as () => number | undefined)()
    expect(updatedAt).toBe(client.getQueryState(queryKeys.domains.list(params))!.dataUpdatedAt)
  })

  it('caches the capabilities for 5 minutes and never serves the deletion preview from cache', async () => {
    seed()
    expect(capabilitiesOptions().staleTime).toBe(300_000)
    const first = await fetchDeletionPreview(client, 'beta.example')
    expect(first.allowed).toBe(true)
    expect(client.getQueryData(queryKeys.domains.deletionPreview('beta.example'))).toBeUndefined()
  })
})

describe('mutations', () => {
  it('updateDomain writes the detail, replaces the entry in cached lists and invalidates them', async () => {
    seed()
    const list = await loadList()
    client.setQueryData(queryKeys.auditEvents.list({}), {
      data: [],
      meta: { total: 0, limit: 25, offset: 0 },
    })
    client.setQueryData(queryKeys.domains.tags({ q: '', limit: 25, sort: 'name' }), {
      data: [],
      meta: { total: 0, limit: 25, offset: 0 },
    })
    const alpha = list.data[0]!
    const saved = await updateDomain(client, 'alpha.example', { description: 'New' }, alpha.etag)
    expect(saved.description).toBe('New')
    expect(client.getQueryData<Domain>(queryKeys.domains.detail('alpha.example'))?.etag).toBe(
      saved.etag,
    )
    const cached = client.getQueryData<{ data: Domain[] }>(queryKeys.domains.list(params))!
    expect(cached.data[0]!.description).toBe('New')
    expect(client.getQueryState(queryKeys.domains.list(params))!.isInvalidated).toBe(true)
    expect(
      client.getQueryState(queryKeys.domains.tags({ q: '', limit: 25, sort: 'name' }))!
        .isInvalidated,
    ).toBe(false)
    expect(client.getQueryState(queryKeys.auditEvents.list({}))!.isInvalidated).toBe(true)
    await updateDomain(client, 'alpha.example', { tags: ['b'] }, saved.etag)
    expect(
      client.getQueryState(queryKeys.domains.tags({ q: '', limit: 25, sort: 'name' }))!
        .isInvalidated,
    ).toBe(true)
  })

  it('createDomain writes the detail without the report and the report under its own key', async () => {
    seed()
    const created = await createDomain(client, { name: 'new.example', restartGroupware: false })
    expect(created.creationReport.dkimKey).toBe('created')
    const detail = client.getQueryData<Domain>(queryKeys.domains.detail('new.example'))!
    expect(detail.name).toBe('new.example')
    expect('creationReport' in detail).toBe(false)
    expect(client.getQueryData(queryKeys.domains.creationReport('new.example'))).toEqual(
      created.creationReport,
    )
  })

  it('deleteDomain removes the detail, footer and preview caches', async () => {
    seed()
    const list = await loadList()
    const beta = list.data[1]!
    client.setQueryData(queryKeys.domains.detail('beta.example'), beta)
    client.setQueryData(queryKeys.domains.footer('beta.example'), { html: '' })
    await deleteDomain(client, 'beta.example', beta.etag)
    expect(client.getQueryData(queryKeys.domains.detail('beta.example'))).toBeUndefined()
    expect(client.getQueryData(queryKeys.domains.footer('beta.example'))).toBeUndefined()
    expect(client.getQueryState(queryKeys.domains.list(params))!.isInvalidated).toBe(true)
  })

  it('a bulk action invalidates the lists, removes deleted details and invalidates changed ones', async () => {
    seed()
    const list = await loadList()
    for (const domain of list.data)
      client.setQueryData(queryKeys.domains.detail(domain.name), domain)
    await applyBulkAction(client, { action: 'delete', targets: [{ id: 'beta.example' }] })
    expect(client.getQueryData(queryKeys.domains.detail('beta.example'))).toBeUndefined()
    await applyBulkAction(client, { action: 'deactivate', targets: [{ id: 'alpha.example' }] })
    expect(client.getQueryState(queryKeys.domains.detail('alpha.example'))!.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryState(queryKeys.domains.list(params))!.isInvalidated).toBe(true)
  })

  it('replaceFooter writes the footer and invalidates the domain, the lists and the audit log', async () => {
    seed()
    const list = await loadList()
    client.setQueryData(queryKeys.domains.detail('alpha.example'), list.data[0])
    client.setQueryData(queryKeys.auditEvents.list({}), {
      data: [],
      meta: { total: 0, limit: 25, offset: 0 },
    })
    const footer = await client.fetchQuery({
      queryKey: queryKeys.domains.footer('alpha.example'),
      queryFn: async () => (await import('@/features/domains/api')).fetchFooter('alpha.example'),
    })
    const saved = await replaceFooter(
      client,
      'alpha.example',
      {
        html: '',
        plain: 'Bye',
        skipReplies: false,
        excludedAddresses: [],
        excludedAliasDomains: [],
      },
      footer.etag,
    )
    expect(client.getQueryData(queryKeys.domains.footer('alpha.example'))).toEqual(saved)
    expect(client.getQueryState(queryKeys.domains.detail('alpha.example'))!.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryState(queryKeys.domains.list(params))!.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.auditEvents.list({}))!.isInvalidated).toBe(true)
  })

  it('template mutations write the detail and invalidate the lists and the audit log', async () => {
    seed()
    client.setQueryData(queryKeys.auditEvents.list({}), {
      data: [],
      meta: { total: 0, limit: 25, offset: 0 },
    })
    client.setQueryData(queryKeys.domainTemplates.list({}), {
      data: [],
      meta: { total: 0, limit: 25, offset: 0 },
    })
    const created = await createTemplate(client, {
      name: 'Small',
      maxMailboxes: 5,
      maxAliases: 400,
      maxMailboxQuota: 10240 * 1_048_576,
      domainQuota: 10240 * 1_048_576,
      active: true,
      globalAddressList: true,
      backupMx: false,
      relayAllRecipients: false,
      relayUnknownOnly: false,
      dkimKeySize: 2048,
    })
    expect(client.getQueryData(queryKeys.domainTemplates.detail(created.id))).toEqual(created)
    expect(client.getQueryState(queryKeys.domainTemplates.list({}))!.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.auditEvents.list({}))!.isInvalidated).toBe(true)
    const updated = await updateTemplate(client, created.id, { maxAliases: 10 }, created.etag)
    expect(updated.maxAliases).toBe(10)
    await deleteTemplate(client, created.id, updated.etag)
    expect(client.getQueryData(queryKeys.domainTemplates.detail(created.id))).toBeUndefined()
  })

  it('a 403 attribute-not-permitted invalidates the identity', async () => {
    seed('reseller')
    client.setQueryData(queryKeys.identity(), { username: 'reseller' })
    const list = await loadList()
    const error = await updateDomain(
      client,
      'alpha.example',
      { description: 'x' },
      list.data[0]!.etag,
    ).catch((problem: unknown) => problem)
    expect(error).toBeInstanceOf(ApiProblem)
    expect((error as ApiProblem).is('attribute-not-permitted')).toBe(true)
    expect(client.getQueryState(queryKeys.identity())!.isInvalidated).toBe(true)
  })

  it('sends quotas as bytes and keeps 412 for the caller', async () => {
    seed()
    const error = await updateDomain(
      client,
      'alpha.example',
      { domainQuota: 20 * GIB },
      '"stale"',
    ).catch((problem: unknown) => problem)
    expect((error as ApiProblem).status).toBe(412)
  })
})
