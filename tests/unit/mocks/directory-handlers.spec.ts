// The mock's list operations of features 003 and 004 that UI 002 reads for the footer's exclusions
// (T088): contract-valid entries of the domains in scope, filtered by domain and search, paged.
import { describe, expect, it } from 'vitest'

import { mockDomain } from '../../mocks/factories/domain'
import { useScenario } from '../../mocks/node'
import { assignDomains } from '../../mocks/scenarios/domains-base'

const api = (path: string) => `${location.origin}/api/v2${path}`

async function get(path: string) {
  const response = await fetch(api(path))

  return { status: response.status, body: await response.json() }
}

function seed(signedInAs = 'admin') {
  const state = useScenario('admin-active', { signedInAs })
  state.domains = [
    mockDomain({
      name: 'one.example',
      mailboxAddresses: ['bob@one.example', 'ann@one.example'],
      aliasAddresses: ['sales@one.example'],
    }),
    mockDomain({ name: 'two.example', mailboxAddresses: ['eve@two.example'], aliasAddresses: [] }),
  ]
  state.aliasDomains = [
    { name: 'alias-one.example', target: 'one.example' },
    { name: 'alias-two.example', target: 'two.example' },
  ]
  assignDomains(state, 'reseller', ['two.example'])
  return state
}

describe('directory list handlers', () => {
  it('lists the mailboxes of a domain, searched and paged', async () => {
    seed()
    const all = await get('/mailboxes?domain=one.example&limit=1')
    expect(all.status).toBe(200)
    expect(all.body.data.map((m: { address: string }) => m.address)).toEqual(['ann@one.example'])
    expect(all.body.meta).toEqual({ total: 2, limit: 1, offset: 0 })
    const searched = await get('/mailboxes?domain=one.example&q=bo')
    expect(searched.body.data.map((m: { address: string }) => m.address)).toEqual([
      'bob@one.example',
    ])
  })

  it('lists the aliases and the alias domains of a domain', async () => {
    seed()
    expect(
      (await get('/aliases?domain=one.example')).body.data.map(
        (a: { address: string }) => a.address,
      ),
    ).toEqual(['sales@one.example'])
    expect(
      (await get('/alias-domains?targetDomain=one.example')).body.data.map(
        (a: { name: string }) => a.name,
      ),
    ).toEqual(['alias-one.example'])
  })

  it('keeps a domain administrator to the domains in scope', async () => {
    seed('reseller')
    expect((await get('/mailboxes')).body.data.map((m: { address: string }) => m.address)).toEqual([
      'eve@two.example',
    ])
    expect((await get('/alias-domains')).body.data.map((a: { name: string }) => a.name)).toEqual([
      'alias-two.example',
    ])
  })
})
