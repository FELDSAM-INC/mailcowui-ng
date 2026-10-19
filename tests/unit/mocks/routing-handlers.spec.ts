// The routing mock handlers (UI 009 T005, T006, T026, T039, T053, T067, T079, T089, T096, T102):
// every response passes the contract validator (the setup file fails a test on any violation), and
// the documented behaviour of API 009 holds.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'
import { TEST_TRANSPORTS } from '../../mocks/scenarios/routing/connection-tests'

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

const codes = (answer: Answer, field: string) =>
  (answer.body.errors?.[field] ?? []).map((item: { code: string }) => item.code)

describe('routing capabilities', () => {
  it('gives administrators every value, domain administrators no administration, mailbox users 403', async () => {
    useScenario('routing-admin-default')
    const admin = await call('GET', '/capabilities/routing')
    expect(admin.body.data.administration.tlsPolicies).toHaveLength(8)
    useScenario('routing-da-bcc')
    expect((await call('GET', '/capabilities/routing')).body.data.administration).toBeNull()
    useScenario('routing-mailbox-user')
    expect((await call('GET', '/capabilities/routing')).status).toBe(403)
  })
})

describe('relayhosts', () => {
  it('lists with usage, search, filters and sorts, and never a password', async () => {
    useScenario('routing-admin-default')
    const all = await call('GET', '/relayhosts')
    expect(all.body.meta.total).toBe(5)
    const two = all.body.data.find((item: { id: number }) => item.id === 2)
    expect(two.usage).toEqual({ domains: 2, mailboxes: 3 })
    expect(JSON.stringify(all.body)).not.toContain('Relay-Secret-1')
    expect(all.body.data[0].passwordSet).toBe(true)
    expect(
      (await call('GET', '/relayhosts?q=alpha')).body.data.map((r: { id: number }) => r.id),
    ).toEqual([4])
    expect((await call('GET', '/relayhosts?active=false')).body.meta.total).toBe(1)
    expect((await call('GET', '/relayhosts?inUse=true')).body.meta.total).toBe(1)
    const sorted = await call('GET', '/relayhosts?sort=domainCount&order=desc')
    expect(sorted.body.data[0].id).toBe(2)
  })

  it('creates with the host grammar and refuses a password without a username', async () => {
    useScenario('routing-admin-empty')
    const created = await call('POST', '/relayhosts', {
      body: { host: '192.0.2.10', username: 'u', password: 'p' },
    })
    expect(created.status).toBe(201)
    expect(created.body.data.host).toBe('[192.0.2.10]')
    expect(created.body.data.passwordSet).toBe(true)
    const invalid = await call('POST', '/relayhosts', { body: { host: 'bad host!' } })
    expect(codes(invalid, 'host')).toEqual(['invalidFormat'])
    const orphanPassword = await call('POST', '/relayhosts', {
      body: { host: 'a.example', password: 'x' },
    })
    expect(invalid.status).toBe(422)
    expect(orphanPassword.body.errors.username[0].params).toEqual({ because: 'password' })
    const colon = await call('POST', '/relayhosts', {
      body: { host: 'a.example', username: 'a:b' },
    })
    expect(codes(colon, 'username')).toEqual(['invalidCharacter'])
  })

  it('keeps an omitted password, removes it with "" and with an empty username, and checks If-Match', async () => {
    useScenario('routing-admin-default')
    const read = await call('GET', '/relayhosts/1')
    const etag = read.headers.get('ETag')!
    const kept = await call('PATCH', '/relayhosts/1', {
      body: { host: '[smtp.example.net]:2525' },
      ifMatch: etag,
    })
    expect(kept.body.data.passwordSet).toBe(true)
    expect(
      (await call('PATCH', '/relayhosts/1', { body: { active: false }, ifMatch: etag })).status,
    ).toBe(412)
    const removed = await call('PATCH', '/relayhosts/1', { body: { password: '' } })
    expect(removed.body.data.passwordSet).toBe(false)
    const cleared = await call('PATCH', '/relayhosts/4', { body: { username: '' } })
    expect(cleared.body.data).toMatchObject({ username: null, passwordSet: false })
    const immutable = await call('PATCH', '/relayhosts/4', { body: { id: 9 } })
    expect(codes(immutable, 'id')).toEqual(['immutable'])
    expect((await call('GET', '/relayhosts/77')).status).toBe(404)
  })

  it('deletes with the assignments cleared, lists usage, and runs bulk actions with versions', async () => {
    const state = useScenario('routing-admin-default')
    const usage = await call('GET', '/relayhosts/2/usage?kind=mailbox&sort=name')
    expect(usage.body.data.map((item: { name: string }) => item.name)).toEqual([
      'alice@example.org',
      'bob@example.org',
      'carol@example.net',
    ])
    expect((await call('DELETE', '/relayhosts/2')).status).toBe(204)
    expect(state.domains.every((domain) => domain.relayhost === null)).toBe(true)
    expect(state.mailboxes.every((mailbox) => mailbox.relayhostId === null)).toBe(true)
    const bulk = await call('POST', '/relayhosts/bulk-actions', {
      body: {
        action: 'deactivate',
        targets: [{ id: '1', version: '"stale"' }, { id: '4' }, { id: '4' }, { id: '99' }],
      },
    })
    expect(bulk.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'outdated',
      'done',
      'notFound',
    ])
  })

  it('refuses more targets than the bulk limit', async () => {
    useScenario('routing-bulk-limit-10')
    const targets = Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1) }))
    const answer = await call('POST', '/relayhosts/bulk-actions', {
      body: { action: 'delete', targets },
    })
    expect(codes(answer, 'targets')).toEqual(['tooMany'])
  })

  it('gives choices with usernames to the permitted roles only', async () => {
    useScenario('routing-da-bcc')
    const choices = await call('GET', '/relayhost-choices?q=smarthost')
    expect(choices.body.data).toEqual([
      { id: 4, host: '[smarthost.example]:587', username: 'alpha', active: true },
      { id: 5, host: '[smarthost.example]:587', username: 'beta', active: true },
    ])
    useScenario('routing-da-readonly')
    const refused = await call('GET', '/relayhost-choices')
    expect(refused.status).toBe(403)
    expect(refused.body.requiredFlags).toEqual(['domainRelayhost', 'mailboxRelayhost'])
  })
})

describe('relayhost assignments', () => {
  it('reports every reference state, the effective and the credentials relayhost', async () => {
    useScenario('routing-assignments')
    const alice = (await call('GET', '/mailboxes/alice@example.org/relayhost-assignment')).body.data
    expect(alice.relayhost.state).toBe('inactive')
    expect(alice.effectiveRelayhost).toMatchObject({ id: 1, source: 'domain' })
    const bob = (await call('GET', '/mailboxes/bob@example.org/relayhost-assignment')).body.data
    expect(bob.effectiveRelayhost).toMatchObject({ id: 5, source: 'mailbox' })
    expect(bob.credentialsRelayhost).toEqual({ id: 1, source: 'domain' })
    const dave = (await call('GET', '/mailboxes/dave@example.net/relayhost-assignment')).body.data
    expect(dave.credentialsRelayhost).toBeNull()
    const carol = (await call('GET', '/mailboxes/carol@example.net/relayhost-assignment')).body.data
    expect(carol.relayhost).toEqual({ id: 99, host: null, state: 'dangling' })
  })

  it('replaces assignments with If-Match, refuses unknown relayhosts and checks the flag first', async () => {
    const state = useScenario('routing-assignments')
    const read = await call('GET', '/domains/example.org/relayhost-assignment')
    const before = state.domains.find((domain) => domain.name === 'example.org')!
    const replaced = await call('PUT', '/domains/example.org/relayhost-assignment', {
      body: { relayhostId: 4 },
      ifMatch: read.headers.get('ETag')!,
    })
    expect(replaced.body.data.relayhost).toMatchObject({ id: 4, state: 'active' })
    expect(before.relayhost).toEqual({ id: 4, hostname: '[smarthost.example]:587' })
    const stale = await call('PUT', '/domains/example.org/relayhost-assignment', {
      body: { relayhostId: null },
      ifMatch: read.headers.get('ETag')!,
    })
    expect(stale.status).toBe(412)
    const unknown = await call('PUT', '/mailboxes/alice@example.org/relayhost-assignment', {
      body: { relayhostId: 77 },
    })
    expect(codes(unknown, 'relayhostId')).toEqual(['notFound'])
    useScenario('routing-da-mailbox-flag-only')
    const refused = await call('PUT', '/domains/nowhere.example/relayhost-assignment', {
      body: { relayhostId: null },
    })
    expect(refused.body.requiredFlags).toEqual(['domainRelayhost'])
    expect((await call('GET', '/domains/example.com/relayhost-assignment')).status).toBe(404)
    expect((await call('GET', '/domains/alias.example/relayhost-assignment')).status).toBe(404)
  })
})

describe('transports', () => {
  it('lists with the shared next hop count and the normalised next hop filter', async () => {
    useScenario('routing-admin-default')
    const list = await call('GET', '/transports?nextHop=[MX.partner.net]:25')
    expect(list.body.data.map((item: { id: number }) => item.id)).toEqual([1, 2])
    expect(list.body.data[0].nextHopSharedWith).toBe(1)
    expect((await call('GET', '/transports?mxBased=true')).body.meta.total).toBe(1)
  })

  it('inherits, refuses different usernames and interference, and reports affected transports', async () => {
    const state = useScenario('routing-admin-default')
    const inherited = await call('POST', '/transports', {
      body: { destination: 'c.example', nextHop: '[mx.partner.net]:25' },
    })
    expect(inherited.status).toBe(201)
    expect(inherited.body.data).toMatchObject({ username: 'u1', passwordSet: true, active: false })
    const differ = await call('POST', '/transports', {
      body: { destination: 'd.example', nextHop: '[mx.partner.net]:25', username: 'u2' },
    })
    expect(differ.body.type).toBe('/api/v2/problems/next-hop-credentials-differ')
    const interferes = await call('POST', '/transports', {
      body: { destination: 'e.example', nextHop: '[relay.net]:587' },
    })
    expect(interferes.body).toMatchObject({ nextHop: 'relay.net', transportIds: [3] })
    const exists = await call('POST', '/transports', {
      body: { destination: 'A.example', nextHop: 'x.net' },
    })
    expect(exists.body).toMatchObject({ field: 'destination', conflictingId: '1' })
    const regex = await call('POST', '/transports', {
      body: { destination: '(', nextHop: 'x.net', mxBased: true },
    })
    expect(codes(regex, 'destination')).toEqual(['invalidRegex'])
    const changed = await call('PATCH', '/transports/1', { body: { password: 'New-Secret' } })
    expect(changed.body.meta.affectedTransports.map((item: { id: number }) => item.id)).toEqual([
      2, 6,
    ])
    expect(state.routing.transports.find((item) => item.id === 2)!.password).toBe('New-Secret')
    const moved = await call('PATCH', '/transports/3', { body: { nextHop: '[mx.partner.net]:25' } })
    expect(moved.body.data.username).toBe('u1')
  })

  it('runs scripted connection tests and refuses invalid addresses', async () => {
    useScenario('routing-tests')
    const accepted = await call('POST', '/relayhosts/1/connection-test', { body: {} })
    expect(accepted.body.data).toMatchObject({
      accepted: true,
      login: 'succeeded',
      sender: 'relay@example.org',
    })
    expect(JSON.stringify(accepted.body)).toContain('[redacted]')
    const login = await call('POST', `/transports/${TEST_TRANSPORTS.login}/connection-test`, {
      body: {},
    })
    expect(login.body.data).toMatchObject({
      accepted: false,
      step: 'login',
      lastReply: { code: 535 },
    })
    const invalid = await call('POST', '/transports/19/connection-test', {
      body: { sender: 'not-an-address' },
    })
    expect(codes(invalid, 'sender')).toEqual(['invalidFormat'])
    const long = await call('POST', `/transports/${TEST_TRANSPORTS.long}/connection-test`, {
      body: {},
    })
    expect(long.body.data.transcript).toHaveLength(501)
  })
})

describe('BCC maps', () => {
  it('scopes the list, hides orphaned maps from domain administrators and checks the flag', async () => {
    useScenario('routing-admin-default')
    const admin = await call('GET', '/bcc-maps?orphaned=true')
    expect(admin.body.data.map((item: { id: number }) => item.id)).toEqual([5])
    useScenario('routing-da-readonly')
    const scoped = await call('GET', '/bcc-maps')
    expect(scoped.body.data.map((item: { id: number }) => item.id)).toEqual([1, 2, 3])
    const refused = await call('POST', '/bcc-maps', {
      body: { localDestination: 'example.org', type: 'sender', bccDestination: 'x@y.example' },
    })
    expect(refused.body.requiredFlags).toEqual(['bccMaps'])
  })

  it('creates from the choices, refuses lists and duplicates, and switches types in bulk', async () => {
    useScenario('routing-da-bcc')
    const choices = await call('GET', '/bcc-destination-choices?q=sales')
    expect(choices.body.data[0]).toMatchObject({
      kind: 'alias',
      deliversTo: ['alice@example.org', 'bob@example.org'],
    })
    const created = await call('POST', '/bcc-maps', {
      body: {
        localDestination: 'example.org',
        type: 'sender',
        bccDestination: 'copy@archive.example',
      },
    })
    expect(created.body.data).toMatchObject({
      localDestination: '@example.org',
      domain: 'example.org',
    })
    const list = await call('POST', '/bcc-maps', {
      body: {
        localDestination: 'bob@example.org',
        type: 'sender',
        bccDestination: 'a@x.example, b@x.example',
      },
    })
    expect(codes(list, 'bccDestination')).toEqual(['tooMany'])
    const duplicate = await call('POST', '/bcc-maps', {
      body: { localDestination: '@example.org', type: 'recipient', bccDestination: 'x@x.example' },
    })
    expect(duplicate.body.field).toBe('localDestination')
    const outside = await call('POST', '/bcc-maps', {
      body: {
        localDestination: 'frank@example.com',
        type: 'sender',
        bccDestination: 'x@x.example',
      },
    })
    expect(codes(outside, 'localDestination')).toEqual(['notFound'])
    const bulk = await call('POST', '/bcc-maps/bulk-actions', {
      body: { action: 'switchToSender', targets: [{ id: '1' }, { id: '4' }] },
    })
    expect(bulk.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'refused',
      'notFound',
    ])
  })
})

describe('recipient and TLS policy maps', () => {
  it('normalises recipient maps and refuses duplicates', async () => {
    useScenario('routing-admin-default')
    const created = await call('POST', '/recipient-maps', {
      body: { originalDestination: 'OLD2.example', newDestination: '@new2.example' },
    })
    expect(created.body.data).toMatchObject({
      originalDestination: '@old2.example',
      newDestination: '@new2.example',
    })
    const duplicate = await call('POST', '/recipient-maps', {
      body: { originalDestination: '@old.example', newDestination: 'x@y.example' },
    })
    expect(duplicate.body.field).toBe('originalDestination')
    const invalid = await call('POST', '/recipient-maps', {
      body: { originalDestination: 'not valid', newDestination: 'x@y.example' },
    })
    expect(codes(invalid, 'originalDestination')).toEqual(['invalidFormat'])
  })

  it('normalises TLS policy maps and refuses bad destinations, parameters and policies', async () => {
    useScenario('routing-admin-default')
    const created = await call('POST', '/tls-policy-maps', {
      body: { destination: 'Bücher.example', policy: 'DANE-only' },
    })
    expect(created.body.data).toMatchObject({
      destination: 'xn--bcher-kva.example',
      policy: 'dane-only',
      parameters: '',
    })
    const invalid = await call('POST', '/tls-policy-maps', {
      body: { destination: 'example.org:25', policy: 'nope', parameters: 'broken' },
    })
    expect(codes(invalid, 'destination')).toEqual(['invalidFormat'])
    expect(codes(invalid, 'policy')).toEqual(['notInList'])
    expect(codes(invalid, 'parameters')).toEqual(['invalidFormat'])
    const filtered = await call('GET', '/tls-policy-maps?policy=none&policy=secure')
    expect(filtered.body.meta.total).toBe(2)
  })
})

describe('forwarding hosts', () => {
  it('adds names, networks and addresses with their outcomes and refuses unresolvable names', async () => {
    useScenario('routing-admin-default')
    const name = await call('POST', '/forwarding-hosts', { body: { host: 'forwarder.example' } })
    expect(name.status).toBe(201)
    expect(name.headers.get('Location')).toBe('/api/v2/forwarding-hosts?source=forwarder.example')
    expect(name.body.data.entries.map((entry: { outcome: string }) => entry.outcome)).toEqual([
      'updated',
      'added',
    ])
    const again = await call('POST', '/forwarding-hosts', { body: { host: 'forwarder.example' } })
    expect(again.status).toBe(200)
    const network = await call('POST', '/forwarding-hosts', { body: { host: '192.0.2.5/24' } })
    expect(network.body.data.entries[0].forwardingHost.address).toBe('192.0.2.0/24')
    const nothing = await call('POST', '/forwarding-hosts', { body: { host: 'nothing.example' } })
    expect(codes(nothing, 'host')).toEqual(['notResolvable'])
    const down = await call('POST', '/forwarding-hosts', { body: { host: 'dns-down.example' } })
    expect(down.status).toBe(503)
    expect(down.headers.get('Retry-After')).toBe('5')
  })

  it('reads, edits and deletes by the percent-encoded address and sorts IPv4 first', async () => {
    useScenario('routing-admin-default')
    const list = await call('GET', '/forwarding-hosts')
    expect(list.body.data.map((host: { address: string }) => host.address)).toEqual([
      '192.0.2.0/24',
      '198.51.100.7',
      '203.0.113.9',
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    ])
    const read = await call('GET', '/forwarding-hosts/192.0.2.0%2F24')
    expect(read.body.data.spamFilter).toBe(false)
    const edited = await call('PATCH', '/forwarding-hosts/192.0.2.0%2F24', {
      body: { spamFilter: true },
    })
    expect(edited.body.data.spamFilter).toBe(true)
    expect((await call('DELETE', '/forwarding-hosts/203.0.113.9')).status).toBe(204)
    const bulk = await call('POST', '/forwarding-hosts/bulk-actions', {
      body: { action: 'disableSpamFilter', targets: [{ id: '198.51.100.7' }] },
    })
    expect(bulk.body.data.summary.done).toBe(1)
  })
})
