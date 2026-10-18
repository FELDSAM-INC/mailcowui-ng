// The UI 004 mock handlers (T014, research R21): the 23 operations of API feature 004 answer as the
// contract documents, and every response passes the contract validator (the setup file fails a
// test on any violation).
import { describe, expect, it } from 'vitest'

import { mockState, useScenario } from '../../mocks/node'
import { ALIAS_004, MAILBOX_004, RESOURCE_004 } from '../../mocks/scenarios/feature-004-base'
import type { ScenarioOverrides, ScenarioState } from '../../mocks/scenarios/state'

const api = (path: string) => `${location.origin}/api/v2${path}`

interface Answer {
  status: number
  headers: Headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

async function csrfToken(): Promise<string> {
  const response = await fetch(api('/csrf-token'))
  return ((await response.json()) as { data: { token: string } }).data.token
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; ifMatch?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  if (options.body !== undefined) {
    headers['Content-Type'] =
      method === 'PATCH' ? 'application/merge-patch+json' : 'application/json'
  }
  if (options.ifMatch) headers['If-Match'] = options.ifMatch
  const response = await fetch(api(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : undefined,
  }
}

const admin = (overrides: ScenarioOverrides = {}): ScenarioState =>
  useScenario('admin-004', overrides)
const domainAdmin = (overrides: ScenarioOverrides = {}): ScenarioState =>
  useScenario('domain-admin-004', overrides)

const addresses = (answer: Answer) =>
  (answer.body.data as { address: string }[]).map((item) => item.address)
const problemType = (answer: Answer) => String(answer.body.type).split('/').at(-1)
const codes = (answer: Answer, path: string) =>
  ((answer.body.errors?.[path] ?? []) as { code: string }[]).map((item) => item.code)

describe('aliases', () => {
  it('lists newest first with the full representation and version tags', async () => {
    admin()
    const answer = await call('GET', '/aliases')
    expect(answer.status).toBe(200)
    const ids = (answer.body.data as { id: number }[]).map((item) => item.id)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(answer.body.meta.total).toBe(answer.body.data.length)
    const sales = answer.body.data.find((item: { id: number }) => item.id === ALIAS_004.sales)
    expect(sales).toMatchObject({
      address: 'sales@example.org',
      kind: 'regular',
      domain: 'example.org',
      inAliasDomain: false,
      primaryDomain: 'example.org',
      destinationType: 'addresses',
      destinations: ['anna@example.org', 'bob@example.org'],
      orphaned: false,
    })
    expect(sales.etag).toMatch(/^"[0-9a-f]+"$/)
  })

  it('derives the alias-domain, catch-all, special-action and orphaned members', async () => {
    admin()
    const get = async (id: number) => (await call('GET', `/aliases/${id}`)).body.data
    expect(await get(ALIAS_004.infoNet)).toMatchObject({
      domain: 'example.net',
      inAliasDomain: true,
      primaryDomain: 'example.org',
    })
    expect(await get(ALIAS_004.catchAll)).toMatchObject({
      kind: 'catchAll',
      address: '@example.org',
    })
    expect(await get(ALIAS_004.noreply)).toMatchObject({
      destinationType: 'discard',
      destinations: [],
      destinationsUnicode: [],
    })
    expect(await get(ALIAS_004.orphaned)).toMatchObject({ orphaned: true })
  })

  it('applies the search, every filter and the sort keys', async () => {
    admin()
    const list = async (query: string) => addresses(await call('GET', `/aliases?${query}`))
    expect(await list('q=SALES')).toEqual(['sales@example.org'])
    expect(await list('q=gina')).toEqual(['contact@other.example'])
    expect(await list('address=SALES@example.org')).toEqual(['sales@example.org'])
    expect(await list('domain=example.net')).toEqual(['info@example.net'])
    expect(await list('primaryDomain=example.org&sort=address')).toEqual([
      '@example.org',
      'info@example.net',
      'info@example.org',
      'noreply@example.org',
      'sales@example.org',
    ])
    expect(await list('kind=catchAll')).toEqual(['@example.org'])
    expect(await list('destinationType=discard')).toEqual(['noreply@example.org'])
    expect(await list('destination=ANNA@example.org&sort=address')).toEqual([
      '@example.org',
      'info@example.org',
      'lost@gone.example',
      'sales@example.org',
    ])
    expect(await list('senderAllowed=false')).toEqual(['info@example.org'])
    expect(await list('active=false')).toEqual([])
    expect(await list('internal=true')).toEqual([])
    expect(await list('groupwareVisible=false')).toEqual([])
    expect((await list('sort=address&order=asc'))[0]).toBe('@example.org')
  })

  it('limits a domain administrator to their domains and their alias domains, never orphaned', async () => {
    domainAdmin()
    const all = addresses(await call('GET', '/aliases?limit=100'))
    expect(all).toContain('info@example.net')
    expect(all).toContain('shared@example.com')
    expect(all).not.toContain('contact@other.example')
    expect(all).not.toContain('lost@gone.example')
    expect((await call('GET', `/aliases/${ALIAS_004.contact}`)).status).toBe(404)
    expect((await call('GET', `/aliases/${ALIAS_004.orphaned}`)).status).toBe(404)
  })

  it('creates an alias with Location, ETag and the legacy defaults', async () => {
    admin()
    const answer = await call('POST', '/aliases', {
      body: { address: 'Office@EXAMPLE.org', destinations: ['bob@example.org'] },
    })
    expect(answer.status).toBe(201)
    expect(answer.body.data).toMatchObject({
      address: 'Office@example.org',
      active: true,
      senderAllowed: true,
      groupwareVisible: true,
      internal: false,
      publicComment: '',
    })
    expect(answer.headers.get('location')).toBe(`/api/v2/aliases/${answer.body.data.id}`)
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
  })

  it.each([
    ['anna@example.org', 'mailbox'],
    ['meetingroom1@example.org', 'resource'],
    ['SALES@example.org', 'alias'],
    ['spam9f3k2@example.org', 'temporaryAlias'],
    ['anna@example.net', 'mailbox'],
  ])('refuses %s as address-in-use held by %s', async (address, holder) => {
    admin()
    const answer = await call('POST', '/aliases', {
      body: { address, destinations: ['bob@example.org'] },
    })
    expect(answer.status).toBe(409)
    expect(problemType(answer)).toBe('address-in-use')
    expect(answer.body.holder).toBe(holder)
  })

  it('refuses an alias over the primary domain alias limit with the count and limit', async () => {
    const state = admin()
    const domain = state.domains.find((item) => item.name === 'example.org')!
    domain.maxAliases = domain.usage.aliases
    const answer = await call('POST', '/aliases', {
      body: { address: 'new@example.net', destinationType: 'discard' },
    })
    expect(answer.status).toBe(409)
    expect(answer.body).toMatchObject({
      type: '/api/v2/problems/domain-alias-limit-reached',
      domain: 'example.org',
      count: domain.usage.aliases,
      limit: domain.usage.aliases,
      requested: 1,
    })
  })

  it('reports every invalid field and entry with its code', async () => {
    admin()
    const invalid = await call('POST', '/aliases', {
      body: {
        address: 'new@example.org',
        destinations: ['not an address', 'new@example.org', 'MeetingRoom1@example.org'],
        privateComment: 'x'.repeat(161),
      },
    })
    expect(invalid.status).toBe(422)
    expect(codes(invalid, 'destinations.0')).toEqual(['invalidFormat'])
    expect(codes(invalid, 'destinations.1')).toEqual(['conflictsWith'])
    expect(codes(invalid, 'destinations.2')).toEqual(['notEligible'])
    expect(invalid.body.errors['destinations.2'][0].params).toEqual({ kind: 'resource' })
    expect(invalid.body.errors.privateComment[0].params).toEqual({ max: 160, unit: 'bytes' })

    const address = await call('POST', '/aliases', {
      body: { address: 'nobody@unknown.example', destinationType: 'discard' },
    })
    expect(address.body.errors.address[0]).toMatchObject({
      code: 'notFound',
      params: { resource: 'domain' },
    })
    const format = await call('POST', '/aliases', {
      body: { address: 'not valid', destinationType: 'discard' },
    })
    expect(format.body.errors.address[0].params).toEqual({ format: 'aliasAddress' })
    const both = await call('POST', '/aliases', {
      body: {
        address: 'x@example.org',
        destinationType: 'learnSpam',
        destinations: ['a@b.example'],
      },
    })
    expect(both.body.errors.destinations[0]).toMatchObject({
      code: 'conflictsWith',
      params: { field: 'destinationType' },
    })
    const none = await call('POST', '/aliases', { body: { address: 'x@example.org' } })
    expect(codes(none, 'destinations')).toEqual(['required'])
  })

  it('refuses external destinations when the server disables them, for every role', async () => {
    admin({ capabilities004: { externalDestinationsDisabled: true } })
    const answer = await call('POST', '/aliases', {
      body: {
        address: 'out@example.org',
        destinations: ['bob@example.org', 'someone@elsewhere.example'],
      },
    })
    expect(answer.status).toBe(422)
    expect(answer.body.errors['destinations.1'][0]).toMatchObject({
      code: 'notEligible',
      params: { kind: 'externalDestination' },
    })
  })

  it('refuses external destinations of a domain administrator without aliasExternalGoto', async () => {
    domainAdmin()
    const answer = await call('POST', '/aliases', {
      body: { address: 'out@example.org', destinations: ['someone@elsewhere.example'] },
    })
    expect(answer.status).toBe(403)
    expect(answer.body).toMatchObject({
      type: '/api/v2/problems/attribute-not-permitted',
      attributes: ['destinations.0'],
      requiredFlags: { 'destinations.0': 'aliasExternalGoto' },
    })
  })

  it('checks If-Match, only added destinations and changed comments on a change', async () => {
    const state = domainAdmin()
    const sales = state.aliases.find((alias) => alias.id === ALIAS_004.sales)!
    sales.destinations = ['anna@example.org', 'ext@partner.example']
    sales.privateComment = 'é'.repeat(150)
    const read = await call('GET', `/aliases/${ALIAS_004.sales}`)
    expect(
      (
        await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
          body: { active: false },
          ifMatch: '"nope"',
        })
      ).status,
    ).toBe(412)

    const deactivated = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { active: false },
      ifMatch: read.body.data.etag,
    })
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.data.active).toBe(false)
    expect(deactivated.headers.get('etag')).not.toBe(read.body.data.etag)

    const kept = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { destinations: ['ext@partner.example', 'bob@example.org'] },
    })
    expect(kept.status).toBe(200)

    const added = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { destinations: ['ext@partner.example', 'new@other.partner.example'] },
    })
    expect(added.status).toBe(403)
    expect(added.body.attributes).toEqual(['destinations.1'])

    const comment = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { privateComment: 'é'.repeat(150), publicComment: 'hello' },
    })
    expect(comment.status).toBe(200)
  })

  it('accepts a change of an orphaned alias only when it moves to an existing domain', async () => {
    admin()
    const refused = await call('PATCH', `/aliases/${ALIAS_004.orphaned}`, {
      body: { active: false },
    })
    expect(refused.status).toBe(422)
    expect(refused.body.errors.address[0]).toMatchObject({
      code: 'notFound',
      params: { resource: 'domain' },
    })
    const moved = await call('PATCH', `/aliases/${ALIAS_004.orphaned}`, {
      body: { address: 'lost@example.org' },
    })
    expect(moved.status).toBe(200)
    expect(moved.body.data).toMatchObject({ orphaned: false, domain: 'example.org' })
  })

  it('refuses read-only members sent with another value as immutable', async () => {
    admin()
    const read = (await call('GET', `/aliases/${ALIAS_004.sales}`)).body.data
    const same = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { ...read, active: false },
    })
    expect(same.status).toBe(200)
    const wrong = await call('PATCH', `/aliases/${ALIAS_004.sales}`, {
      body: { domain: 'example.com' },
    })
    expect(wrong.status).toBe(422)
    expect(codes(wrong, 'domain')).toEqual(['immutable'])
  })

  it('deletes with If-Match and removes the sender permissions to send as the address', async () => {
    const state = admin()
    const read = await call('GET', `/aliases/${ALIAS_004.sales}`)
    expect((await call('DELETE', `/aliases/${ALIAS_004.sales}`, { ifMatch: '"old"' })).status).toBe(
      412,
    )
    const deleted = await call('DELETE', `/aliases/${ALIAS_004.sales}`, {
      ifMatch: read.body.data.etag,
    })
    expect(deleted.status).toBe(204)
    expect((await call('GET', `/aliases/${ALIAS_004.sales}`)).status).toBe(404)
    expect(state.senderAcl.some((entry) => entry.sendAs === 'sales@example.org')).toBe(false)
  })

  it('copies over alias domains with per-alias-domain outcomes', async () => {
    const state = admin()
    state.aliasDomains.push({ name: 'example.info', target: 'example.org' })
    state.aliases.push({
      ...state.aliases.find((alias) => alias.id === ALIAS_004.sales)!,
      id: 900,
      address: 'sales@example.info',
    })
    const answer = await call('POST', `/aliases/${ALIAS_004.sales}/alias-domain-copies`)
    expect(answer.status).toBe(200)
    expect(answer.body.data.copies).toEqual([
      expect.objectContaining({
        aliasDomain: 'example.info',
        outcome: 'skipped',
        reason: 'addressInUse',
        aliasId: null,
      }),
      expect.objectContaining({
        aliasDomain: 'example.net',
        outcome: 'created',
        address: 'sales@example.net',
        reason: null,
      }),
    ])
    const created = answer.body.data.copies[1].aliasId as number
    expect((await call('GET', `/aliases/${created}`)).body.data.destinations).toEqual([
      'anna@example.org',
      'bob@example.org',
    ])
    const refused = await call('POST', `/aliases/${ALIAS_004.infoNet}/alias-domain-copies`)
    expect(refused.status).toBe(409)
    expect(problemType(refused)).toBe('not-primary-domain-alias')
    const empty = await call('POST', `/aliases/${ALIAS_004.contact}/alias-domain-copies`)
    expect(empty.body.data.copies).toEqual([])
  })

  it('applies bulk actions per target with outdated, notFound and copies', async () => {
    const state = domainAdmin()
    const list = await call('GET', '/aliases?limit=100')
    const sales = list.body.data.find((item: { id: number }) => item.id === ALIAS_004.sales)
    const answer = await call('POST', '/aliases/bulk-actions', {
      body: {
        action: 'deactivate',
        targets: [
          { id: String(ALIAS_004.sales), version: sales.etag.replaceAll('"', '') },
          { id: String(ALIAS_004.shared), version: 'stale' },
          { id: String(ALIAS_004.contact) },
          { id: '99999' },
        ],
      },
    })
    expect(answer.status).toBe(200)
    expect(answer.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'done',
      'outdated',
      'notFound',
      'notFound',
    ])
    expect(answer.body.data.summary).toMatchObject({ total: 4, done: 1, outdated: 1, notFound: 2 })
    expect(state.aliases.find((alias) => alias.id === ALIAS_004.sales)!.active).toBe(false)

    const copy = await call('POST', '/aliases/bulk-actions', {
      body: {
        action: 'copyOverAliasDomains',
        targets: [{ id: String(ALIAS_004.noreply) }, { id: String(ALIAS_004.infoNet) }],
      },
    })
    expect(copy.body.data.results[1]).toMatchObject({ outcome: 'refused' })
    expect(copy.body.data.results[1].problem.type).toBe('/api/v2/problems/not-primary-domain-alias')
    expect(copy.body.meta.copies[String(ALIAS_004.noreply)][0]).toMatchObject({
      address: 'noreply@example.net',
      outcome: 'created',
    })
  })

  it('refuses more targets than the bulk limit with tooMany', async () => {
    admin({ capabilities004: { bulkLimit: 2 } })
    const answer = await call('POST', '/aliases/bulk-actions', {
      body: { action: 'activate', targets: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    })
    expect(answer.status).toBe(422)
    expect(answer.body.errors.targets[0]).toMatchObject({ code: 'tooMany', params: { max: 2 } })
  })

  it('reads the capabilities, without DKIM defaults for a domain administrator without aliasDomains', async () => {
    admin()
    const forAdmin = (await call('GET', '/capabilities/aliases')).body.data
    expect(forAdmin).toMatchObject({
      bulkLimit: 100,
      commentMaxBytes: 160,
      dkimDnsPublicationEnabled: false,
    })
    expect(forAdmin.dkimDefaults).toEqual({ selector: 'dkim', keySize: 2048 })
    domainAdmin()
    const forDomainAdmin = (await call('GET', '/capabilities/aliases')).body.data
    expect(forDomainAdmin.dkimDefaults).toBeNull()
    expect(forDomainAdmin.dkimDnsPublicationEnabled).toBeNull()
  })

  it('refuses mailbox users', async () => {
    useScenario('mailbox-user-004')
    expect((await call('GET', '/aliases')).status).toBe(403)
    expect((await call('GET', '/capabilities/aliases')).status).toBe(403)
  })
})

describe('alias domains', () => {
  it('lists, filters and reads alias domains with alias count and relay state', async () => {
    const state = admin()
    state.domains.find((item) => item.name === 'example.com')!.backupMx = true
    const list = await call('GET', '/alias-domains?targetDomain=example.org')
    expect(list.body.data.map((item: { name: string }) => item.name)).toEqual(['example.net'])
    expect(list.body.data[0]).toMatchObject({
      targetDomain: 'example.org',
      aliasCount: 1,
      active: true,
    })
    const detail = await call('GET', '/alias-domains/EXAMPLE.eu')
    expect(detail.body.data).toMatchObject({
      name: 'example.eu',
      targetIsRelayDomain: true,
      rateLimit: null,
    })
    expect(detail.headers.get('etag')).toBe(detail.body.data.etag)
    expect((await call('GET', '/alias-domains?q=EU')).body.meta.total).toBe(1)
  })

  it('creates an alias domain with its creation report', async () => {
    admin()
    const answer = await call('POST', '/alias-domains', {
      body: {
        name: 'Example.Biz',
        targetDomain: 'example.org',
        rateLimit: { value: 500, frame: 'hour' },
      },
    })
    expect(answer.status).toBe(201)
    expect(answer.headers.get('location')).toBe('/api/v2/alias-domains/example.biz')
    expect(answer.body.data).toMatchObject({
      name: 'example.biz',
      rateLimit: { value: 500, frame: 'hour' },
      creationReport: {
        rateLimit: 'applied',
        dkimKey: 'created',
        dkimDnsPublication: 'notConfigured',
        groupwareDirectoryUpdate: 'done',
      },
    })
    const none = await call('POST', '/alias-domains', {
      body: { name: 'nodkim.example', targetDomain: 'example.org', dkimSelector: '' },
    })
    expect(none.body.data.creationReport).toMatchObject({
      dkimKey: 'notRequested',
      dkimDnsPublication: 'skipped',
    })
  })

  it('applies injected report outcomes with messages for failed steps', async () => {
    admin({ aliasDomainCreationOutcomes: { dkimKey: 'failed' } })
    const answer = await call('POST', '/alias-domains', {
      body: { name: 'fail.example', targetDomain: 'example.org' },
    })
    expect(answer.body.data.creationReport.dkimKey).toBe('failed')
    expect(answer.body.data.creationReport.messages.dkimKey).toEqual(expect.any(String))
  })

  it('refuses existing names, the host name, its target and relay targets', async () => {
    const state = admin()
    state.domains.find((item) => item.name === 'relay.example')!.backupMx = true
    const exists = (name: string) =>
      call('POST', '/alias-domains', { body: { name, targetDomain: 'example.org' } })
    expect((await exists('example.com')).body).toMatchObject({
      existingKind: 'domain',
      name: 'example.com',
    })
    expect((await exists('example.net')).body).toMatchObject({ existingKind: 'aliasDomain' })
    expect(codes(await exists(state.serverHostname), 'name')).toEqual(['reserved'])
    expect(codes(await exists('example.org'), 'name')).toEqual(['conflictsWith'])
    const relay = await call('POST', '/alias-domains', {
      body: { name: 'new.example', targetDomain: 'relay.example' },
    })
    expect(relay.body.errors.targetDomain[0]).toMatchObject({
      code: 'notEligible',
      params: { kind: 'relayDomain' },
    })
    const aliasTarget = await call('POST', '/alias-domains', {
      body: { name: 'new.example', targetDomain: 'example.net' },
    })
    expect(aliasTarget.body.errors.targetDomain[0].params).toEqual({ kind: 'aliasDomain' })
  })

  it('needs aliasDomains to create and ratelimit for an initial rate limit', async () => {
    domainAdmin()
    const flag = await call('POST', '/alias-domains', {
      body: { name: 'x.example', targetDomain: 'example.org' },
    })
    expect(flag.status).toBe(403)
    expect(flag.body).toMatchObject({
      type: '/api/v2/problems/permission-flag-required',
      requiredFlags: ['aliasDomains'],
    })
    useScenario('domain-admin-004', { flags: { reseller: { aliasDomains: true } } })
    const rate = await call('POST', '/alias-domains', {
      body: {
        name: 'x.example',
        targetDomain: 'example.org',
        rateLimit: { value: 1, frame: 'day' },
      },
    })
    expect(rate.status).toBe(403)
    expect(rate.body).toMatchObject({
      attributes: ['rateLimit'],
      requiredFlags: { rateLimit: 'ratelimit' },
    })
  })

  it('refuses a target change over the new target alias limit', async () => {
    const state = admin()
    const target = state.domains.find((item) => item.name === 'example.com')!
    target.maxAliases = target.usage.aliases
    const read = await call('GET', '/alias-domains/example.net')
    const answer = await call('PATCH', '/alias-domains/example.net', {
      body: { targetDomain: 'example.com' },
      ifMatch: read.body.data.etag,
    })
    expect(answer.status).toBe(409)
    expect(answer.body).toMatchObject({ domain: 'example.com', requested: 1 })
    const moved = await call('PATCH', '/alias-domains/example.net', { body: { active: false } })
    expect(moved.body.data.active).toBe(false)
    expect(
      (
        await call('PATCH', '/alias-domains/example.net', {
          body: { active: true },
          ifMatch: read.body.data.etag,
        })
      ).status,
    ).toBe(412)
  })

  it('deletes an alias domain with its aliases, permissions and temporary aliases', async () => {
    const state = admin()
    state.temporaryAliasAddresses.push('tmp@example.net')
    state.senderAcl.push({ mailbox: 'anna@example.org', sendAs: '@example.net', external: false })
    expect((await call('DELETE', '/alias-domains/example.net')).status).toBe(204)
    expect(state.aliasDomains.some((item) => item.name === 'example.net')).toBe(false)
    expect(state.aliases.some((alias) => alias.address.endsWith('@example.net'))).toBe(false)
    expect(state.temporaryAliasAddresses).not.toContain('tmp@example.net')
    expect(state.senderAcl.some((entry) => entry.sendAs === '@example.net')).toBe(false)
  })

  it('answers 503 temporary-failure while the shared store is down', async () => {
    admin({ sharedStoreDown: true })
    const list = await call('GET', '/alias-domains')
    expect(list.status).toBe(503)
    expect(problemType(list)).toBe('temporary-failure')
    expect((await call('DELETE', '/alias-domains/example.net')).status).toBe(503)
    const bulk = await call('POST', '/alias-domains/bulk-actions', {
      body: { action: 'deactivate', targets: [{ id: 'example.net' }] },
    })
    expect(bulk.body.data.results[0]).toMatchObject({ outcome: 'failed' })
  })

  it('applies bulk actions without the aliasDomains flag', async () => {
    const state = domainAdmin()
    const answer = await call('POST', '/alias-domains/bulk-actions', {
      body: { action: 'deactivate', targets: [{ id: 'example.net' }, { id: 'unknown.example' }] },
    })
    expect(answer.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'done',
      'notFound',
    ])
    expect(state.aliasDomains.find((item) => item.name === 'example.net')!.active).toBe(false)
  })
})

describe('resources', () => {
  it('derives the address from the description, keeping letter case', async () => {
    admin()
    const answer = await call('POST', '/resources', {
      body: { description: 'Raum Süd', domain: 'example.org', kind: 'location' },
    })
    expect(answer.status).toBe(201)
    expect(answer.body.data).toMatchObject({
      address: 'RaumSd@example.org',
      bookingRule: 'unlimited',
      bookingLimit: null,
      active: true,
    })
  })

  it('refuses a description without letters or digits and a derived address in use', async () => {
    admin()
    const format = await call('POST', '/resources', {
      body: { description: '!!!', domain: 'example.org', kind: 'thing' },
    })
    expect(format.body.errors.description[0].params).toEqual({ format: 'resourceDescription' })
    const used = await call('POST', '/resources', {
      body: { description: 'Meeting-Room 1', domain: 'example.org', kind: 'location' },
    })
    expect(used.status).toBe(409)
    expect(used.body).toMatchObject({ holder: 'resource', address: 'MeetingRoom1@example.org' })
  })

  it('checks the booking rules', async () => {
    admin()
    const conflict = await call('POST', '/resources', {
      body: {
        description: 'Car',
        domain: 'example.org',
        kind: 'thing',
        bookingRule: 'alwaysFree',
        bookingLimit: 2,
      },
    })
    expect(conflict.body.errors.bookingLimit[0]).toMatchObject({
      code: 'conflictsWith',
      params: { field: 'bookingRule' },
    })
    const missing = await call('POST', '/resources', {
      body: { description: 'Car', domain: 'example.org', kind: 'thing', bookingRule: 'limited' },
    })
    expect(codes(missing, 'bookingLimit')).toEqual(['required'])
    const limited = await call('PATCH', `/resources/${RESOURCE_004.meetingRoom}`, {
      body: { bookingRule: 'limited', bookingLimit: 2 },
    })
    expect(limited.body.data).toMatchObject({ bookingRule: 'limited', bookingLimit: 2 })
    const free = await call('PATCH', `/resources/${RESOURCE_004.meetingRoom}`, {
      body: { bookingRule: 'alwaysFree' },
    })
    expect(free.body.data).toMatchObject({ bookingRule: 'alwaysFree', bookingLimit: null })
  })

  it('lists, filters, deletes and applies bulk actions within the scope', async () => {
    domainAdmin()
    const list = await call('GET', '/resources')
    expect(addresses(list)).toEqual(['MeetingRoom1@example.org', 'Projector@example.com'])
    expect((await call('GET', '/resources?kind=thing')).body.meta.total).toBe(1)
    expect((await call('GET', `/resources/${RESOURCE_004.teamCalendar}`)).status).toBe(404)
    const bulk = await call('POST', '/resources/bulk-actions', {
      body: {
        action: 'delete',
        targets: [{ id: RESOURCE_004.projector }, { id: RESOURCE_004.teamCalendar }],
      },
    })
    expect(bulk.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'done',
      'notFound',
    ])
    const read = await call('GET', `/resources/${RESOURCE_004.meetingRoom}`)
    expect(
      (await call('DELETE', `/resources/${RESOURCE_004.meetingRoom}`, { ifMatch: '"x"' })).status,
    ).toBe(412)
    expect(
      (
        await call('DELETE', `/resources/${RESOURCE_004.meetingRoom}`, {
          ifMatch: read.body.data.etag,
        })
      ).status,
    ).toBe(204)
  })
})

describe('sender settings', () => {
  it('explains the implicit addresses and marks explicit permissions', async () => {
    domainAdmin()
    const answer = await call('GET', `/mailboxes/${MAILBOX_004.anna}/sender-settings`)
    expect(answer.status).toBe(200)
    const data = answer.body.data
    expect(
      data.implicitAddresses.map((item: { address: string; source: string }) => [
        item.address,
        item.source,
      ]),
    ).toEqual([
      ['anna@example.org', 'ownAddress'],
      ['anna@example.net', 'aliasDomainAddress'],
      ['@example.org', 'alias'],
      ['info@example.org', 'alias'],
      ['lost@gone.example', 'alias'],
      ['sales@example.org', 'alias'],
    ])
    expect(data.explicitPermissions).toEqual([
      expect.objectContaining({
        value: '@deleted.example',
        stale: true,
        kind: null,
        changeable: false,
      }),
      expect.objectContaining({
        value: '@example.com',
        kind: 'domain',
        changeable: true,
        stale: false,
      }),
      expect.objectContaining({ value: '@other.example', kind: 'domain', changeable: false }),
    ])
    expect(data.senderCheckDisabled).toBe(false)
    expect(data.externalSenderAddresses).toEqual(['@partner.example', 'news@mailer.example'])
    expect(answer.headers.get('etag')).toBe(data.etag)
  })

  it('replaces whole sets and keeps the entries outside a domain administrator scope', async () => {
    const state = domainAdmin()
    const read = await call('GET', `/mailboxes/${MAILBOX_004.anna}/sender-settings`)
    const answer = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { explicitPermissions: ['info@example.org'] },
      ifMatch: read.body.data.etag,
    })
    expect(answer.status).toBe(200)
    expect(
      answer.body.data.explicitPermissions.map((item: { value: string }) => item.value).sort(),
    ).toEqual(['@deleted.example', '@other.example', 'info@example.org'])
    expect(
      state.senderAcl.filter((entry) => entry.mailbox === MAILBOX_004.anna && entry.external),
    ).toHaveLength(2)
    expect(
      (
        await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
          body: { explicitPermissions: [] },
          ifMatch: read.body.data.etag,
        })
      ).status,
    ).toBe(412)
  })

  it('stores any address alone and refuses it for domain administrators', async () => {
    admin()
    const any = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { explicitPermissions: ['@example.com', '*'] },
    })
    expect(any.body.data.explicitPermissions.map((item: { value: string }) => item.value)).toEqual([
      '*',
    ])
    expect(any.body.data.senderCheckDisabled).toBe(true)
    domainAdmin()
    const refused = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { explicitPermissions: ['*'] },
    })
    expect(refused.body.errors['explicitPermissions.0'][0]).toMatchObject({
      code: 'notEligible',
      params: { allowedRoles: ['admin'] },
    })
  })

  it('refuses local external addresses, unknown entries and changes without extendSenderAcl', async () => {
    admin()
    const local = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: {
        externalSenderAddresses: ['news@mailer.example', 'x@example.net'],
        explicitPermissions: ['nobody@example.org', 'not valid!'],
      },
    })
    expect(local.status).toBe(422)
    expect(local.body.errors['externalSenderAddresses.1'][0]).toMatchObject({
      code: 'notEligible',
      params: { kind: 'localDomain' },
    })
    expect(local.body.errors['explicitPermissions.0'][0]).toMatchObject({
      code: 'notFound',
      params: { resource: 'address' },
    })
    expect(local.body.errors['explicitPermissions.1'][0].params).toEqual({
      format: 'senderPermission',
    })
    domainAdmin()
    const flag = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { externalSenderAddresses: ['other@partner.example'] },
    })
    expect(flag.status).toBe(403)
    expect(flag.body).toMatchObject({
      attributes: ['externalSenderAddresses'],
      requiredFlags: { externalSenderAddresses: 'extendSenderAcl' },
    })
    const unchanged = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { externalSenderAddresses: ['NEWS@mailer.example', '@partner.example'] },
    })
    expect(unchanged.status).toBe(200)
  })

  it('drops an added alias that already lets the mailbox send', async () => {
    admin()
    const answer = await call('PATCH', `/mailboxes/${MAILBOX_004.anna}/sender-settings`, {
      body: { explicitPermissions: ['sales@example.org', '@example.com'] },
    })
    expect(
      answer.body.data.explicitPermissions.map((item: { value: string }) => item.value),
    ).toEqual(['@example.com'])
  })

  it('answers 404 for a mailbox outside the scope', async () => {
    domainAdmin()
    expect((await call('GET', '/mailboxes/gina@other.example/sender-settings')).status).toBe(404)
    expect(
      (await call('GET', `/mailboxes/${RESOURCE_004.meetingRoom}/sender-settings`)).status,
    ).toBe(404)
  })

  it('lists the candidates with search, type, paging and the legacy exclusions', async () => {
    admin()
    const all = await call(
      'GET',
      `/sender-permission-candidates?mailbox=${MAILBOX_004.anna}&limit=100`,
    )
    const values = (all.body.data as { value: string }[]).map((item) => item.value)
    expect(values[0]).toBe('*')
    expect(values).toContain('@example.net')
    expect(values).toContain('bob@example.org')
    expect(values).toContain('shared@example.com')
    expect(values).toContain('@example.org')
    for (const excluded of [
      'anna@example.org',
      'anna@example.net',
      'sales@example.org',
      'info@example.org',
      'lost@gone.example',
      '@example.com',
    ]) {
      expect(values).not.toContain(excluded)
    }
    const bob = all.body.data.find((item: { value: string }) => item.value === 'bob@example.org')
    expect(bob).toMatchObject({ type: 'address', kind: 'mailbox' })
    const shared = all.body.data.find(
      (item: { value: string }) => item.value === 'shared@example.com',
    )
    expect(shared.kind).toBe('alias')
    const domains = await call(
      'GET',
      `/sender-permission-candidates?mailbox=${MAILBOX_004.anna}&type=domain&q=NET`,
    )
    expect(domains.body.data).toEqual([
      { value: '@example.net', valueUnicode: '@example.net', type: 'domain', kind: 'aliasDomain' },
    ])
    const paged = await call(
      'GET',
      `/sender-permission-candidates?mailbox=${MAILBOX_004.anna}&limit=2&offset=1`,
    )
    expect(paged.body.data).toHaveLength(2)
    expect(paged.body.meta.total).toBe(all.body.meta.total)
    domainAdmin()
    const scoped = await call(
      'GET',
      `/sender-permission-candidates?mailbox=${MAILBOX_004.anna}&limit=100`,
    )
    const scopedValues = (scoped.body.data as { value: string }[]).map((item) => item.value)
    expect(scopedValues).not.toContain('*')
    expect(scopedValues).not.toContain('gina@other.example')
    const missing = await call('GET', '/sender-permission-candidates?mailbox=gina@other.example')
    expect(missing.status).toBe(422)
    expect(missing.body.errors.mailbox[0].code).toBe('notFound')
  })
})

describe('scenario patches', () => {
  it('changes and deletes objects elsewhere, changing their version tags', async () => {
    admin()
    const before = (await call('GET', `/aliases/${ALIAS_004.sales}`)).body.data.etag
    const state = mockState()
    const { applyOverrides } = await import('../../mocks/scenarios')
    applyOverrides(state, {
      changeElsewhere: { alias: { 'sales@example.org': { destinations: ['bob@example.org'] } } },
      deleteElsewhere: { resource: [RESOURCE_004.projector] },
      flags: { reseller: { aliasExternalGoto: true } },
    })
    const after = (await call('GET', `/aliases/${ALIAS_004.sales}`)).body.data
    expect(after.etag).not.toBe(before)
    expect(after.modifiedAt).not.toBeNull()
    expect((await call('GET', `/resources/${RESOURCE_004.projector}`)).status).toBe(404)
    expect(
      state.accounts.find((account) => account.username === 'reseller')!.permissions
        .aliasExternalGoto,
    ).toBe(true)
  })
})
