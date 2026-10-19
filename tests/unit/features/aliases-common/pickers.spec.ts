// The domain picker sources of UI 004 (research D11, R7): the caller's domains and alias domains,
// searched and paged by the server in name order, under the query keys their mutations refresh,
// with each domain's readable name and whether it is a relay domain.
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'
import { aliasDomainPickerSource, domainPickerSource } from '@/features/aliases-common'

import { mockState, useScenario } from '../../../mocks/node'

describe('domainPickerSource', () => {
  it("pages the caller's domains by name with the readable name and the relay flag", async () => {
    useScenario('admin-004')
    const source = domainPickerSource('Domains')
    expect(source.label).toBe('Domains')
    expect(source.queryKey('ex')).toEqual([...queryKeys.domains.lists(), 'picker', { q: 'ex' }])
    const page = await source.fetchPage({ q: '', offset: 0, limit: 3 })
    expect(page.total).toBe(10)
    expect(page.items.map((item) => item.name)).toEqual([
      'alpha.example',
      'beta.example',
      'delta.example',
    ])
    const relay = await source.fetchPage({ q: 'relay', offset: 0, limit: 10 })
    expect(relay.items).toEqual([
      { name: 'relay.example', nameUnicode: 'relay.example', relay: true },
    ])
    const idn = await source.fetchPage({ q: 'xn--bcher', offset: 0, limit: 10 })
    expect(idn.items[0]!.nameUnicode).toBe('bücher.example')
    const query = mockState().requests.at(-1)!.path
    expect(query).toContain('sort=name')
    expect(query).toContain('q=xn--bcher')
  })

  it('offers a domain administrator only the domains of the scope', async () => {
    useScenario('domain-admin-004')
    const page = await domainPickerSource().fetchPage({ q: '', offset: 0, limit: 25 })
    expect(page.items.map((item) => item.name)).toEqual(['example.com', 'example.org'])
  })
})

describe('aliasDomainPickerSource', () => {
  it("pages the caller's alias domains by name under the alias domain options key", async () => {
    useScenario('alias-domains-admin')
    const source = aliasDomainPickerSource()
    expect(source.queryKey('net')).toEqual(queryKeys.aliasDomains.options('net'))
    const page = await source.fetchPage({ q: '', offset: 0, limit: 25 })
    expect(page.total).toBe(3)
    expect(page.items).toEqual([
      { name: 'example.eu', nameUnicode: 'example.eu' },
      { name: 'example.net', nameUnicode: 'example.net' },
      { name: 'legacy.example', nameUnicode: 'legacy.example' },
    ])
    const searched = await source.fetchPage({ q: 'legacy', offset: 0, limit: 25 })
    expect(searched.items.map((item) => item.name)).toEqual(['legacy.example'])
  })
})
