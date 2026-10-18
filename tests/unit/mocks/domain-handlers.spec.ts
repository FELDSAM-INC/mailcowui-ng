// The domain and template mock handlers (UI 002 T008, research D28): every response passes the
// contract validator (the setup file fails a test on any violation), and each documented behaviour
// of API 002 holds.
import { describe, expect, it } from 'vitest'

import { domainAuditEvent } from '../../mocks/factories/audit-event'
import { GIB, MIB, mockDomain } from '../../mocks/factories/domain'
import { mockFooter } from '../../mocks/factories/domain-footer'
import { mockTemplate } from '../../mocks/factories/domain-template'
import { useScenario } from '../../mocks/node'
import { assignDomains, defaultTemplate } from '../../mocks/scenarios/domains-base'
import type { ScenarioState } from '../../mocks/scenarios/state'

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

const names = (answer: Answer) => (answer.body.data as { name: string }[]).map((d) => d.name)

/** Four domains, an alias domain, a template and a reseller of two domains. */
function seed(
  signedInAs = 'admin',
  overrides: Parameters<typeof useScenario>[1] = {},
): ScenarioState {
  const state = useScenario('admin-active', { signedInAs, ...overrides })
  state.domains = [
    mockDomain({
      name: 'alpha.example',
      description: 'Alpha Corp',
      tags: ['customer-a', 'Zeta'],
      maxMailboxes: 10,
      maxAliases: 400,
      domainQuota: 50 * GIB,
      maxMailboxQuota: 10 * GIB,
      createdAt: '2026-01-03T10:00:00.000Z',
      usage: {
        mailboxes: 8,
        resources: 0,
        aliases: 380,
        largestMailboxQuota: 5 * GIB,
        quotaAllocated: 30 * GIB,
        storageUsed: 9 * GIB,
        messages: 1200,
      },
    }),
    mockDomain({
      name: 'beta.example',
      active: false,
      backupMx: true,
      tags: ['customer-b'],
      createdAt: '2026-01-01T10:00:00.000Z',
      usage: {
        mailboxes: 0,
        resources: 1,
        aliases: 2,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
    mockDomain({
      name: 'MÜNCHEN.de',
      description: 'Munich',
      createdAt: '2026-01-02T10:00:00.000Z',
    }),
    mockDomain({
      name: 'gamma.example',
      backupMx: true,
      relayAllRecipients: true,
      createdAt: '2026-01-04T10:00:00.000Z',
      modifiedAt: '2026-02-01T10:00:00.000Z',
    }),
  ]
  state.aliasDomains = [{ name: 'alias.example', target: 'beta.example' }]
  state.domainTemplates = [
    mockTemplate({ id: 1, name: 'Default', maxMailboxes: 7 }),
    mockTemplate({
      id: 2,
      name: 'Reseller',
      maxMailboxes: 50,
      domainQuota: 50 * GIB,
      tags: ['reseller'],
    }),
  ]
  assignDomains(state, 'reseller', ['alpha.example', 'beta.example'])
  return state
}

describe('listDomains', () => {
  it('searches the ASCII name, the readable name, the description and the tags', async () => {
    seed()
    expect(names(await call('GET', '/domains?q=customer'))).toEqual([
      'alpha.example',
      'beta.example',
    ])
    expect(names(await call('GET', `/domains?q=${encodeURIComponent('münchen')}`))).toEqual([
      'xn--mnchen-3ya.de',
    ])
    expect(names(await call('GET', '/domains?q=XN--MNCHEN'))).toEqual(['xn--mnchen-3ya.de'])
    expect(names(await call('GET', '/domains?q=alpha%20corp'))).toEqual(['alpha.example'])
  })

  it('filters by active state, relay state and whole tags ignoring case', async () => {
    seed()
    expect(names(await call('GET', '/domains?active=false'))).toEqual(['beta.example'])
    expect(names(await call('GET', '/domains?backupMx=true'))).toEqual([
      'beta.example',
      'gamma.example',
    ])
    expect(names(await call('GET', '/domains?tag=CUSTOMER-A&tag=customer-b'))).toEqual([
      'alpha.example',
      'beta.example',
    ])
    expect(names(await call('GET', '/domains?tag=customer'))).toEqual([])
  })

  it.each([
    'name',
    'description',
    'active',
    'backupMx',
    'mailboxes',
    'aliases',
    'quotaAllocated',
    'storageUsed',
    'maxMailboxes',
    'maxAliases',
    'maxMailboxQuota',
    'domainQuota',
    'createdAt',
    'modifiedAt',
  ])('sorts by %s in both orders, ties broken by name', async (sort) => {
    seed()
    const asc = names(await call('GET', `/domains?sort=${sort}&order=asc`))
    const desc = names(await call('GET', `/domains?sort=${sort}&order=desc`))
    expect(asc).toHaveLength(4)
    expect(desc).toHaveLength(4)
    if (sort === 'createdAt') {
      expect(asc).toEqual(['beta.example', 'xn--mnchen-3ya.de', 'alpha.example', 'gamma.example'])
      expect(desc).toEqual([...asc].reverse())
    }
    if (sort === 'mailboxes') expect(desc[0]).toBe('alpha.example')
    if (sort === 'name')
      expect(asc).toEqual(['alpha.example', 'beta.example', 'gamma.example', 'xn--mnchen-3ya.de'])
    if (sort === 'active') expect(asc[0]).toBe('beta.example')
  })

  it('pages with meta.total', async () => {
    seed()
    const page = await call('GET', '/domains?limit=2&offset=1')
    expect(page.body.meta).toEqual({ total: 4, limit: 2, offset: 1 })
    expect(names(page)).toEqual(['beta.example', 'gamma.example'])
  })

  it('shows a domain administrator only their domains, never domainAdmins', async () => {
    seed('reseller')
    const list = await call('GET', '/domains')
    expect(names(list)).toEqual(['alpha.example', 'beta.example'])
    expect(list.body.data[0].domainAdmins).toBeUndefined()
    seed('admin')
    const admin = await call('GET', '/domains')
    expect(admin.body.data[0].domainAdmins).toEqual(['reseller'])
  })

  it('refuses mailbox users', async () => {
    seed('alice@example.org')
    expect((await call('GET', '/domains')).status).toBe(403)
  })
})

describe('getDomain', () => {
  it('normalises the path name and sends the version tag as ETag', async () => {
    seed()
    const answer = await call('GET', `/domains/${encodeURIComponent('MÜNCHEN.de')}`)
    expect(answer.status).toBe(200)
    expect(answer.body.data.name).toBe('xn--mnchen-3ya.de')
    expect(answer.body.data.unicodeName).toBe('münchen.de')
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
  })

  it('answers 404 for a domain outside the scope and for an alias domain name', async () => {
    seed('reseller')
    expect((await call('GET', '/domains/gamma.example')).status).toBe(404)
    seed('admin')
    expect((await call('GET', '/domains/alias.example')).status).toBe(404)
  })

  it('computes the derived usage figures', async () => {
    seed()
    const { usage } = (await call('GET', '/domains/alpha.example')).body.data
    expect(usage).toMatchObject({
      mailboxesLeft: 2,
      aliasesLeft: 20,
      maxNewMailboxQuota: 10 * GIB,
      aliasDomains: 0,
    })
  })
})

describe('createDomain', () => {
  it('pre-fills from the Default template and answers 201 with Location, ETag and the report', async () => {
    seed()
    const answer = await call('POST', '/domains', { body: { name: 'New.Example' } })
    expect(answer.status).toBe(201)
    expect(answer.headers.get('location')).toBe('/api/v2/domains/new.example')
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
    expect(answer.body.data).toMatchObject({
      name: 'new.example',
      maxMailboxes: 7,
      description: 'new.example',
    })
    expect(answer.body.data.creationReport).toEqual({
      rateLimit: 'notRequested',
      dkimKey: 'created',
      dkimDnsPublication: 'notConfigured',
      groupwareRestart: 'notRequested',
    })
  })

  it('uses the built-in values without a Default template', async () => {
    const state = seed()
    state.domainTemplates = []
    const answer = await call('POST', '/domains', { body: { name: 'plain.example' } })
    expect(answer.body.data).toMatchObject({
      maxMailboxes: 10,
      maxAliases: 400,
      maxMailboxQuota: 10240 * MIB,
      domainQuota: 10240 * MIB,
      active: true,
      globalAddressList: true,
      tags: [],
      rateLimit: null,
    })
  })

  it('uses a chosen template, sent values override it, and relay options are normalised', async () => {
    seed()
    const answer = await call('POST', '/domains', {
      body: { name: 'r.example', templateId: 2, maxMailboxes: 20, relayUnknownOnly: true },
    })
    expect(answer.body.data).toMatchObject({
      maxMailboxes: 20,
      domainQuota: 50 * GIB,
      tags: ['reseller'],
      backupMx: true,
      relayAllRecipients: true,
      relayUnknownOnly: true,
    })
  })

  it('refuses invalid names, the server host name and unknown templates', async () => {
    const state = seed()
    const bad = await call('POST', '/domains', { body: { name: 'bad_name.example' } })
    expect(bad.status).toBe(422)
    expect(bad.body.errors.name[0]).toMatchObject({
      code: 'invalidFormat',
      params: { format: 'domainName' },
    })
    const reserved = await call('POST', '/domains', {
      body: { name: state.serverHostname.toUpperCase() },
    })
    expect(reserved.body.errors.name[0].code).toBe('reserved')
    const template = await call('POST', '/domains', { body: { name: 't.example', templateId: 99 } })
    expect(template.body.errors.templateId[0].code).toBe('notFound')
  })

  it('checks quota multiples, the quota order and the tagging limit', async () => {
    seed()
    const multiple = await call('POST', '/domains', {
      body: { name: 'q.example', domainQuota: MIB + 1 },
    })
    expect(multiple.body.errors.domainQuota[0]).toMatchObject({
      code: 'notMultipleOf',
      params: { factor: MIB },
    })
    const order = await call('POST', '/domains', {
      body: {
        name: 'q.example',
        maxMailboxQuota: 10 * GIB,
        domainQuota: 5 * GIB,
      },
    })
    expect(order.body.errors.maxMailboxQuota[0]).toMatchObject({
      code: 'mustNotExceed',
      params: { field: 'domainQuota', value: 5 * GIB },
    })
    const tags = await call('POST', '/domains', {
      body: { name: 'q.example', tags: Array.from({ length: 26 }, (_, i) => `t${i}`) },
    })
    expect(tags.body.errors.tags[0]).toMatchObject({ code: 'tooMany', params: { max: 25 } })
  })

  it('answers 409 domain-exists for a domain or alias domain in any spelling', async () => {
    seed()
    for (const name of ['ALPHA.example', 'alias.example', 'münchen.DE']) {
      const answer = await call('POST', '/domains', { body: { name } })
      expect(answer.status).toBe(409)
      expect(answer.body.type).toBe('/api/v2/problems/domain-exists')
    }
  })

  it('answers 503 temporary-failure with Retry-After when injected', async () => {
    seed('admin', {
      failures: { createDomain: { status: 503, type: 'temporary-failure', retryAfter: 10 } },
    })
    const answer = await call('POST', '/domains', { body: { name: 'x.example' } })
    expect(answer.status).toBe(503)
    expect(answer.headers.get('retry-after')).toBe('10')
    expect(answer.body.type).toBe('/api/v2/problems/temporary-failure')
  })

  it("reports the scenario's step outcomes and an existing DKIM key", async () => {
    const state = seed()
    state.creationReport = { groupwareRestart: 'failed' }
    state.dkimKeys = ['old.example']
    const answer = await call('POST', '/domains', {
      body: { name: 'old.example', restartGroupware: true },
    })
    expect(answer.body.data.creationReport).toMatchObject({
      dkimKey: 'alreadyExisted',
      dkimDnsPublication: 'skipped',
      groupwareRestart: 'failed',
    })
    const none = await call('POST', '/domains', {
      body: { name: 'none.example', dkimSelector: '' },
    })
    expect(none.body.data.creationReport.dkimKey).toBe('notRequested')
  })

  it('reports groupwareDisabled when the groupware is off, and refuses domain administrators', async () => {
    const state = seed()
    state.domainCapabilities.groupwareEnabled = false
    const answer = await call('POST', '/domains', {
      body: { name: 'g.example', restartGroupware: true },
    })
    expect(answer.body.data.creationReport).toMatchObject({
      groupwareRestart: 'groupwareDisabled',
    })
    seed('reseller')
    expect((await call('POST', '/domains', { body: { name: 'h.example' } })).status).toBe(403)
  })
})

describe('updateDomain', () => {
  async function current(name = 'alpha.example') {
    return (await call('GET', `/domains/${name}`)).body.data as {
      etag: string
      [key: string]: unknown
    }
  }

  it('applies a merge patch with If-Match and answers with a new version tag', async () => {
    seed()
    const before = await current()
    const answer = await call('PATCH', '/domains/alpha.example', {
      body: { description: 'New' },
      ifMatch: before.etag,
    })
    expect(answer.status).toBe(200)
    expect(answer.body.data).toMatchObject({
      description: 'New',
      maxMailboxes: 10,
      tags: ['customer-a', 'Zeta'],
    })
    expect(answer.body.data.etag).not.toBe(before.etag)
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
  })

  it('answers 412 when If-Match does not match', async () => {
    seed()
    const answer = await call('PATCH', '/domains/alpha.example', {
      body: { description: 'x' },
      ifMatch: '"stale"',
    })
    expect(answer.status).toBe(412)
  })

  it('refuses changed limits below usage with the value in use', async () => {
    seed()
    const { etag } = await current()
    const answer = await call('PATCH', '/domains/alpha.example', {
      body: { maxMailboxes: 5, maxAliases: 300, maxMailboxQuota: 2 * GIB, domainQuota: 20 * GIB },
      ifMatch: etag,
    })
    expect(answer.status).toBe(422)
    expect(answer.body.errors.maxMailboxes[0]).toMatchObject({
      code: 'belowInUse',
      params: { inUse: 8 },
    })
    expect(answer.body.errors.maxAliases[0]).toMatchObject({
      code: 'belowInUse',
      params: { inUse: 380 },
    })
    expect(answer.body.errors.maxMailboxQuota[0]).toMatchObject({
      code: 'belowInUse',
      params: { inUse: 5 * GIB },
    })
    expect(answer.body.errors.domainQuota[0]).toMatchObject({
      code: 'belowInUse',
      params: { inUse: 30 * GIB },
    })
  })

  it('refuses attributes a domain administrator may not change, naming them', async () => {
    const state = seed('reseller')
    state.accounts.find((a) => a.username === 'reseller')!.permissions.domainDesc = false
    const { etag, maxMailboxes } = await current()
    const refused = await call('PATCH', '/domains/alpha.example', {
      body: { maxMailboxes: 12, description: 'x', globalAddressList: false },
      ifMatch: etag,
    })
    expect(refused.status).toBe(403)
    expect(refused.body.type).toBe('/api/v2/problems/attribute-not-permitted')
    expect(refused.body.attributes).toEqual(['maxMailboxes', 'description'])
    const unchanged = await call('PATCH', '/domains/alpha.example', {
      body: { maxMailboxes, globalAddressList: false },
      ifMatch: etag,
    })
    expect(unchanged.status).toBe(200)
  })

  it('lets a domain administrator with domainDesc change the description', async () => {
    seed('reseller')
    const { etag } = await current()
    const answer = await call('PATCH', '/domains/alpha.example', {
      body: { description: 'Mine' },
      ifMatch: etag,
    })
    expect(answer.status).toBe(200)
  })

  it('refuses a changed read-only member as immutable, and stores an empty description as the name', async () => {
    seed()
    const { etag } = await current()
    const immutable = await call('PATCH', '/domains/alpha.example', {
      body: { createdAt: '2020-01-01T00:00:00Z' },
      ifMatch: etag,
    })
    expect(immutable.body.errors.createdAt[0].code).toBe('immutable')
    const empty = await call('PATCH', '/domains/alpha.example', {
      body: { description: '' },
      ifMatch: etag,
    })
    expect(empty.body.data.description).toBe('alpha.example')
  })

  it('normalises relay options', async () => {
    seed()
    const { etag } = await current()
    const answer = await call('PATCH', '/domains/alpha.example', {
      body: { relayUnknownOnly: true },
      ifMatch: etag,
    })
    expect(answer.body.data).toMatchObject({
      backupMx: true,
      relayAllRecipients: true,
      relayUnknownOnly: true,
    })
  })

  it('applies the tagging limit, but lets an over-limit set shrink', async () => {
    const state = seed()
    state.domains[0]!.tags = Array.from(
      { length: 27 },
      (_, i) => `tag-${String(i).padStart(2, '0')}`,
    )
    const { etag, tags } = await current()
    const grow = await call('PATCH', '/domains/alpha.example', {
      body: { tags: [...(tags as string[]).slice(1), 'other'] },
      ifMatch: etag,
    })
    expect(grow.body.errors.tags[0]).toMatchObject({ code: 'tooMany', params: { max: 25 } })
    const shrink = await call('PATCH', '/domains/alpha.example', {
      body: { tags: (tags as string[]).slice(1) },
      ifMatch: etag,
    })
    expect(shrink.status).toBe(200)
    expect(shrink.body.data.tags).toHaveLength(26)
  })
})

describe('deleteDomain and previewDomainDeletion', () => {
  it('previews blockers, removals, accounts to delete, the DKIM key and the version tag', async () => {
    const state = seed()
    state.domains[0]!.usage.mailboxes = 150
    state.footers['beta.example'] = mockFooter({ plain: 'Bye' })
    state.dkimKeys = ['beta.example']
    assignDomains(state, 'solo', ['beta.example'])
    const blocked = (await call('GET', '/domains/alpha.example/deletion-preview')).body.data
    expect(blocked.allowed).toBe(false)
    expect(blocked.blockers.mailboxes.count).toBe(150)
    expect(blocked.blockers.mailboxes.addresses).toHaveLength(100)
    const preview = (await call('GET', '/domains/beta.example/deletion-preview')).body.data
    expect(preview).toMatchObject({
      domain: 'beta.example',
      allowed: false,
      blockers: { resources: { count: 1 } },
      removals: { aliasDomains: ['alias.example'], aliases: { count: 2 }, footer: true },
      domainAdminsToDelete: ['solo'],
      dkimKeyKept: true,
    })
    expect(preview.etag).toBe((await call('GET', '/domains/beta.example')).body.data.etag)
  })

  it('needs If-Match, refuses a domain that is not empty and answers 404 for an unknown one', async () => {
    seed()
    const { etag } = (await call('GET', '/domains/alpha.example')).body.data
    expect((await call('DELETE', '/domains/alpha.example', { ifMatch: '"stale"' })).status).toBe(
      412,
    )
    const notEmpty = await call('DELETE', '/domains/alpha.example', { ifMatch: etag })
    expect(notEmpty.status).toBe(409)
    expect(notEmpty.body).toMatchObject({
      type: '/api/v2/problems/domain-not-empty',
      mailboxes: 8,
      resources: 0,
    })
    expect((await call('DELETE', '/domains/nope.example', { ifMatch: '"x"' })).status).toBe(404)
  })

  it('deletes, removes alias domains and assignments, and deletes administrators left without a domain', async () => {
    const state = seed()
    assignDomains(state, 'solo', ['gamma.example'])
    const { etag } = (await call('GET', '/domains/gamma.example')).body.data
    expect((await call('DELETE', '/domains/gamma.example', { ifMatch: etag })).status).toBe(204)
    expect(state.domains.map((d) => d.name)).not.toContain('gamma.example')
    expect(state.accounts.find((a) => a.username === 'solo')).toBeUndefined()
    expect((await call('GET', '/domains/gamma.example')).status).toBe(404)
  })

  it('answers an injected temporary failure for one domain with Retry-After', async () => {
    const state = seed()
    state.domainFailures['gamma.example'] = { status: 503, type: 'temporary-failure' }
    const { etag } = (await call('GET', '/domains/gamma.example')).body.data
    const answer = await call('DELETE', '/domains/gamma.example', { ifMatch: etag })
    expect(answer.status).toBe(503)
    expect(answer.headers.get('retry-after')).not.toBeNull()
  })
})

describe('footer', () => {
  it('reads an empty footer, and an absent and a stored empty footer share the version tag', async () => {
    const state = seed()
    const absent = (await call('GET', '/domains/alpha.example/footer')).body.data
    expect(absent).toMatchObject({
      html: '',
      plain: '',
      skipReplies: false,
      excludedAddresses: [],
      excludedAliasDomains: [],
    })
    state.footers['alpha.example'] = mockFooter()
    expect((await call('GET', '/domains/alpha.example/footer')).body.data.etag).toBe(absent.etag)
  })

  it('refuses exclusions outside the domain by position, oversized texts, and an outdated version', async () => {
    const state = seed()
    state.domains[1]!.mailboxAddresses = ['bob@beta.example']
    const { etag } = (await call('GET', '/domains/beta.example/footer')).body.data
    const refused = await call('PUT', '/domains/beta.example/footer', {
      body: {
        html: '<p>Hi</p>',
        plain: 'Hi',
        skipReplies: true,
        excludedAddresses: ['bob@beta.example', 'other@else.example'],
        excludedAliasDomains: ['nope.example'],
      },
      ifMatch: etag,
    })
    expect(refused.status).toBe(422)
    expect(refused.body.errors['excludedAddresses.1'][0].code).toBe('notFound')
    expect(refused.body.errors['excludedAliasDomains.0'][0].code).toBe('notFound')
    expect(refused.body.errors['excludedAddresses.0']).toBeUndefined()

    const big = await call('PUT', '/domains/beta.example/footer', {
      body: { html: 'é'.repeat(600_000), plain: '', skipReplies: false },
      ifMatch: etag,
    })
    expect(big.body.errors.html[0]).toMatchObject({
      code: 'tooLong',
      params: { max: 1_048_576, unit: 'bytes' },
    })

    expect(
      (
        await call('PUT', '/domains/beta.example/footer', {
          body: { html: '', plain: '', skipReplies: false },
          ifMatch: '"x"',
        })
      ).status,
    ).toBe(412)

    const saved = await call('PUT', '/domains/beta.example/footer', {
      body: {
        html: '',
        plain: 'Bye',
        skipReplies: false,
        excludedAddresses: ['BOB@beta.example'],
        excludedAliasDomains: ['alias.example'],
      },
      ifMatch: etag,
    })
    expect(saved.status).toBe(200)
    expect(saved.body.data).toMatchObject({
      excludedAddresses: ['bob@beta.example'],
      excludedAliasDomains: ['alias.example'],
    })
    expect((await call('GET', '/domains/beta.example')).body.data.footer).toEqual({
      set: true,
      htmlBytes: 0,
      plainBytes: 3,
      skipReplies: false,
      excludedAddressCount: 1,
      excludedAliasDomainCount: 1,
    })
  })

  it('summarises the footer on the domain (G28): an absent footer reads as not set', async () => {
    const state = seed()
    expect((await call('GET', '/domains/alpha.example')).body.data.footer).toEqual({
      set: false,
      htmlBytes: 0,
      plainBytes: 0,
      skipReplies: false,
      excludedAddressCount: 0,
      excludedAliasDomainCount: 0,
    })
    state.footers['alpha.example'] = mockFooter({ html: '<p>Čau</p>', skipReplies: true })
    expect((await call('GET', '/domains/alpha.example')).body.data.footer).toMatchObject({
      set: true,
      htmlBytes: 11,
      skipReplies: true,
    })
  })
})

describe('capabilities and tags', () => {
  it('returns dkim and the template defaults to administrators only', async () => {
    const state = seed()
    const admin = (await call('GET', '/capabilities/domains')).body.data
    expect(admin.dkim.defaultSelector).toBe('dkim')
    expect(admin.templateDefaults).toMatchObject({
      maxMailboxes: 10,
      maxAliases: 400,
      rateLimit: null,
      dkimSelector: 'dkim',
      dkimKeySize: 2048,
    })
    state.domainCapabilities.dkim!.defaultSelector = 'feldhost'
    expect(
      (await call('GET', '/capabilities/domains')).body.data.templateDefaults.dkimSelector,
    ).toBe('feldhost')
    seed('reseller')
    const reseller = (await call('GET', '/capabilities/domains')).body.data
    expect(reseller.dkim).toBeUndefined()
    expect(reseller.templateDefaults).toBeUndefined()
    expect(reseller.taggingLimit).toBe(25)
  })

  it('lists the distinct tags in scope, searched and sorted', async () => {
    const state = seed()
    state.domains[3]!.tags = ['customer-a', 'gold']
    const all = await call('GET', '/domain-tags')
    expect(all.body.data).toEqual([
      { name: 'customer-a', domainCount: 2 },
      { name: 'customer-b', domainCount: 1 },
      { name: 'gold', domainCount: 1 },
      { name: 'Zeta', domainCount: 1 },
    ])
    expect((await call('GET', '/domain-tags?q=CUST')).body.meta.total).toBe(2)
    expect((await call('GET', '/domain-tags?sort=domainCount&order=desc')).body.data[0].name).toBe(
      'customer-a',
    )
    seed('reseller')
    expect(
      (await call('GET', '/domain-tags')).body.data.map((t: { name: string }) => t.name),
    ).toEqual(['customer-a', 'customer-b', 'Zeta'])
  })
})

describe('applyDomainBulkAction', () => {
  it('reports done, notFound, refused, outdated and failed per target, in request order', async () => {
    const state = seed()
    state.domainFailures['gamma.example'] = { status: 503, type: 'temporary-failure' }
    const list = (await call('GET', '/domains')).body.data as { name: string; etag: string }[]
    // G33: the exact etag, quotes included, or the tag without them.
    const version = (name: string) => list.find((d) => d.name === name)!.etag
    const bare = (name: string) => version(name).replaceAll('"', '')
    const answer = await call('POST', '/domains/bulk-actions', {
      body: {
        action: 'delete',
        targets: [
          { id: 'xn--mnchen-3ya.de', version: bare('xn--mnchen-3ya.de') },
          { id: 'nope.example' },
          { id: 'alpha.example', version: version('alpha.example') },
          { id: 'beta.example', version: 'stale' },
          { id: 'gamma.example' },
        ],
      },
    })
    expect(answer.status).toBe(200)
    expect(answer.body.data.results.map((r: { outcome: string }) => r.outcome)).toEqual([
      'done',
      'notFound',
      'refused',
      'outdated',
      'failed',
    ])
    expect(answer.body.data.results[2].problem.type).toBe('/api/v2/problems/domain-not-empty')
    expect(answer.body.data.summary).toEqual({
      total: 5,
      done: 1,
      notFound: 1,
      refused: 1,
      outdated: 1,
      failed: 1,
    })
  })

  it('returns the new version after done, skips the check without a version and reports a name once', async () => {
    seed()
    const answer = await call('POST', '/domains/bulk-actions', {
      body: { action: 'deactivate', targets: [{ id: 'alpha.example' }, { id: 'ALPHA.example' }] },
    })
    expect(answer.body.data.results).toHaveLength(1)
    expect(answer.body.data.results[0]).toMatchObject({ id: 'alpha.example', outcome: 'done' })
    const fresh = (await call('GET', '/domains/alpha.example')).body.data
    expect(fresh.active).toBe(false)
    expect(answer.body.data.results[0].version).toBe(fresh.etag)
  })

  it('refuses more targets than the bulk limit, and domain administrators', async () => {
    const state = seed()
    state.domainCapabilities.bulkLimit = 20
    const many = await call('POST', '/domains/bulk-actions', {
      body: {
        action: 'activate',
        targets: Array.from({ length: 21 }, (_, i) => ({ id: `d${i}.example` })),
      },
    })
    expect(many.status).toBe(422)
    expect(many.body.errors.targets[0]).toMatchObject({ code: 'tooMany', params: { max: 20 } })
    seed('reseller')
    expect(
      (
        await call('POST', '/domains/bulk-actions', {
          body: { action: 'activate', targets: [{ id: 'alpha.example' }] },
        })
      ).status,
    ).toBe(403)
  })
})

describe('domain templates', () => {
  it('lists, searches and sorts', async () => {
    const state = seed()
    state.domainTemplates.push(mockTemplate({ id: 3, name: 'small' }))
    const list = await call('GET', '/domain-templates')
    expect(list.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Default',
      'Reseller',
      'small',
    ])
    expect(list.body.data[0].isDefault).toBe(true)
    expect((await call('GET', '/domain-templates?q=SELL')).body.meta.total).toBe(1)
    expect((await call('GET', '/domain-templates?sort=id&order=desc')).body.data[0].id).toBe(3)
  })

  it('creates with the legacy defaults and the server default selector', async () => {
    const state = seed()
    state.domainCapabilities.dkim!.defaultSelector = 'feldhost'
    const answer = await call('POST', '/domain-templates', {
      body: { name: 'Small', maxMailboxes: 5 },
    })
    expect(answer.status).toBe(201)
    expect(answer.headers.get('location')).toBe(`/api/v2/domain-templates/${answer.body.data.id}`)
    expect(answer.body.data).toMatchObject({
      name: 'Small',
      maxMailboxes: 5,
      maxAliases: 400,
      dkimSelector: 'feldhost',
      dkimKeySize: 2048,
      isDefault: false,
    })
  })

  it('refuses a duplicate name ignoring case, and renaming or deleting Default', async () => {
    seed()
    const duplicate = await call('POST', '/domain-templates', { body: { name: 'reseller' } })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.type).toBe('/api/v2/problems/domain-template-name-exists')
    const def = (await call('GET', '/domain-templates/1')).body.data
    const rename = await call('PATCH', '/domain-templates/1', {
      body: { name: 'Base' },
      ifMatch: def.etag,
    })
    expect(rename.body.type).toBe('/api/v2/problems/domain-template-protected')
    const same = await call('PATCH', '/domain-templates/1', {
      body: { name: 'Default', maxMailboxes: 9 },
      ifMatch: def.etag,
    })
    expect(same.status).toBe(200)
    const remove = await call('DELETE', '/domain-templates/1', { ifMatch: same.body.data.etag })
    expect(remove.body.type).toBe('/api/v2/problems/domain-template-protected')
  })

  it('needs a matching If-Match to change or delete', async () => {
    const state = seed()
    expect(
      (await call('PATCH', '/domain-templates/2', { body: { maxMailboxes: 1 }, ifMatch: '"x"' }))
        .status,
    ).toBe(412)
    expect((await call('DELETE', '/domain-templates/2', { ifMatch: '"x"' })).status).toBe(412)
    const { etag } = (await call('GET', '/domain-templates/2')).body.data
    expect((await call('DELETE', '/domain-templates/2', { ifMatch: etag })).status).toBe(204)
    expect(state.domainTemplates.map((t) => t.id)).toEqual([1])
    expect((await call('GET', '/domain-templates/2')).status).toBe(404)
  })

  it('refuses template operations to domain administrators', async () => {
    seed('reseller')
    expect((await call('GET', '/domain-templates')).status).toBe(403)
  })
})

describe('domain audit records', () => {
  it('builds contract-valid domain, footer and template records', () => {
    const event = domainAuditEvent('domainUpdate', { id: 'alpha.example', name: 'alpha.example' })
    expect(event.target).toEqual({ type: 'domain', id: 'alpha.example', name: 'alpha.example' })
    expect(defaultTemplate().name).toBe('Default')
  })
})
