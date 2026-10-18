// The mailbox mock handlers of the foundation (UI 003 T010, research R20): every response passes
// the contract validator (the setup file fails a test on any violation), and each documented
// behaviour of API 003 that the screens rely on holds.
import { describe, expect, it } from 'vitest'

import { GIB, MIB, mockDomain } from '../../mocks/factories/domain'
import { mockMailbox, seedMailboxes } from '../../mocks/factories/mailbox'
import { mockMailboxTemplate } from '../../mocks/factories/mailbox-template'
import { passwordPolicyEtag } from '../../mocks/factories/password-policy'
import { useScenario } from '../../mocks/node'
import { applyOverrides } from '../../mocks/scenarios'
import { assignDomains } from '../../mocks/scenarios/domains-base'
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

const addresses = (answer: Answer) =>
  (answer.body.data as { address: string }[]).map((item) => item.address)

/** Mailboxes in two domains and a reseller of one, with the domain figures in step. */
function seed(
  signedInAs = 'admin',
  overrides: Parameters<typeof useScenario>[1] = {},
): ScenarioState {
  const state = useScenario('admin-active', { signedInAs, ...overrides })
  state.domains = [
    mockDomain({
      name: 'a.example',
      domainQuota: 20 * GIB,
      maxMailboxQuota: 10 * GIB,
      maxMailboxes: 50,
    }),
    mockDomain({ name: 'xn--bcher-kva.example', domainQuota: 20 * GIB, maxMailboxQuota: 10 * GIB }),
  ]
  state.mailboxes = []
  seedMailboxes(state, [
    mockMailbox({
      localPart: 'anna',
      domain: 'a.example',
      displayName: 'Anna',
      quota: 2 * GIB,
      quotaUsed: GIB,
      tags: ['Sales'],
      lastLogins: { imap: '2026-10-10T08:00:00Z', pop3: null, smtp: null, webmailSso: null },
    }),
    mockMailbox({ localPart: 'bob', domain: 'a.example', displayName: 'Joanna Bob', quota: GIB }),
    mockMailbox({
      localPart: 'carl',
      domain: 'a.example',
      displayName: 'Carl',
      tags: ['Annapolis', 'sales'],
      status: 'inactive',
      authSource: 'ldap',
      customAttributes: { old: '1' },
    }),
    mockMailbox({
      localPart: 'dora',
      domain: 'xn--bcher-kva.example',
      quota: 4 * GIB,
      quotaUsed: 3 * GIB,
    }),
  ])
  assignDomains(state, 'reseller', ['a.example'])
  return state
}

describe('listMailboxes', () => {
  it('lists the scope: all for administrators, the managed domains for domain administrators', async () => {
    seed()
    expect(addresses(await call('GET', '/mailboxes'))).toEqual([
      'anna@a.example',
      'bob@a.example',
      'carl@a.example',
      'dora@xn--bcher-kva.example',
    ])
    seed('reseller')
    expect(addresses(await call('GET', '/mailboxes'))).toEqual([
      'anna@a.example',
      'bob@a.example',
      'carl@a.example',
    ])
  })

  it('searches address, display name and tags literally, ignoring letter case', async () => {
    seed()
    expect(addresses(await call('GET', '/mailboxes?q=ANNA'))).toEqual([
      'anna@a.example',
      'bob@a.example',
      'carl@a.example',
    ])
    expect(addresses(await call('GET', `/mailboxes?q=${encodeURIComponent('a%')}`))).toEqual([])
  })

  it('filters by domain (any form), status, tag and source, several values each', async () => {
    seed()
    expect(
      addresses(await call('GET', `/mailboxes?domain=${encodeURIComponent('bücher.example')}`)),
    ).toEqual(['dora@xn--bcher-kva.example'])
    expect(
      addresses(await call('GET', '/mailboxes?status=inactive&status=active&domain=a.example')),
    ).toEqual(['anna@a.example', 'bob@a.example', 'carl@a.example'])
    expect(addresses(await call('GET', '/mailboxes?tag=SALES'))).toEqual([
      'anna@a.example',
      'carl@a.example',
    ])
    expect(addresses(await call('GET', '/mailboxes?authSource=ldap'))).toEqual(['carl@a.example'])
  })

  it('sorts every field in both orders with missing values last', async () => {
    seed()
    expect(addresses(await call('GET', '/mailboxes?sort=percentUsed&order=desc'))).toEqual([
      'dora@xn--bcher-kva.example',
      'anna@a.example',
      'bob@a.example',
      'carl@a.example',
    ])
    expect(addresses(await call('GET', '/mailboxes?sort=percentUsed&order=asc')).at(-1)).toBe(
      'carl@a.example',
    )
    expect(addresses(await call('GET', '/mailboxes?sort=lastMailLogin&order=asc'))[0]).toBe(
      'anna@a.example',
    )
    for (const sort of [
      'address',
      'displayName',
      'domain',
      'status',
      'quota',
      'quotaUsed',
      'messageCount',
      'passwordChangedAt',
      'createdAt',
      'modifiedAt',
    ]) {
      expect((await call('GET', `/mailboxes?sort=${sort}&order=desc`)).status).toBe(200)
    }
  })

  it('pages with limit and offset and reports the total', async () => {
    seed()
    const answer = await call('GET', '/mailboxes?limit=2&offset=2')
    expect(addresses(answer)).toEqual(['carl@a.example', 'dora@xn--bcher-kva.example'])
    expect(answer.body.meta).toEqual({ total: 4, limit: 2, offset: 2 })
  })
})

describe('getMailbox', () => {
  it('sends the ETag of data.etag and the computed figures', async () => {
    seed()
    const answer = await call('GET', '/mailboxes/ANNA@a.example')
    expect(answer.status).toBe(200)
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
    expect(answer.body.data).toMatchObject({
      address: 'anna@a.example',
      percentUsed: 50,
      largestAllowedQuota: 10 * GIB,
    })
    const unlimited = await call('GET', '/mailboxes/carl@a.example')
    expect(unlimited.body.data.percentUsed).toBeNull()
  })

  it('answers 404 outside the scope, the same as for a missing mailbox', async () => {
    seed('reseller')
    expect((await call('GET', '/mailboxes/dora@xn--bcher-kva.example')).status).toBe(404)
    expect((await call('GET', '/mailboxes/nobody@a.example')).status).toBe(404)
  })

  it('injects a 503 with Retry-After', async () => {
    const state = seed()
    state.mailboxFailures['anna@a.example'] = {
      status: 503,
      type: 'temporary-failure',
      operations: ['getMailbox'],
      extra: { dependency: 'mailStore' },
    }
    const answer = await call('GET', '/mailboxes/anna@a.example')
    expect(answer.status).toBe(503)
    expect(answer.headers.get('retry-after')).toBe('30')
  })

  it('leaves out the user permissions a domain administrator may not see', async () => {
    const state = seed('reseller')
    state.accounts.find((account) => account.username === 'reseller')!.permissions.syncjobs = false
    const answer = await call('GET', '/mailboxes/anna@a.example')
    expect(answer.body.data.userPermissions).not.toHaveProperty('syncjobs')
    expect(answer.body.data.userPermissions).toHaveProperty('spamAlias')
  })
})

describe('capabilities, tags, templates and the password policy', () => {
  it('returns the scenario capabilities', async () => {
    seed('admin', { mailboxCapabilities: { taggingLimit: 5, authSources: ['mailcow', 'ldap'] } })
    const answer = await call('GET', '/capabilities/mailboxes')
    expect(answer.body.data).toMatchObject({ taggingLimit: 5, authSources: ['mailcow', 'ldap'] })
  })

  it('merges tag spellings, counts the mailboxes in scope, searches and pages', async () => {
    seed()
    const answer = await call('GET', '/mailbox-tags')
    expect(answer.body.data).toEqual([
      { name: 'Annapolis', mailboxCount: 1 },
      { name: 'Sales', mailboxCount: 2 },
    ])
    expect((await call('GET', '/mailbox-tags?q=nap')).body.data).toEqual([
      { name: 'Annapolis', mailboxCount: 1 },
    ])
    expect((await call('GET', '/mailbox-tags?limit=1&offset=1')).body.meta.total).toBe(2)
  })

  it('lists and reads templates with search, sort and paging', async () => {
    const state = seed()
    state.mailboxTemplates.push(
      mockMailboxTemplate({ id: 2, name: 'Small', quota: GIB }),
      mockMailboxTemplate({ id: 3, name: 'Staff' }),
    )
    const list = await call('GET', '/mailbox-templates?q=s&sort=name&order=desc')
    expect(list.body.data.map((item: { name: string }) => item.name)).toEqual(['Staff', 'Small'])
    const one = await call('GET', '/mailbox-templates/1')
    expect(one.body.data).toMatchObject({ name: 'Default', isDefault: true, quota: 0 })
    expect(one.headers.get('etag')).toBe(one.body.data.etag)
    expect((await call('GET', '/mailbox-templates/99')).status).toBe(404)
  })

  it('returns the password policy with its documented version tag, and a 503 on demand', async () => {
    const state = seed('admin', { passwordPolicy: { minLength: 10, requireDigits: true } })
    const answer = await call('GET', '/password-policy')
    expect(answer.body.data).toMatchObject({ minLength: 10, requireDigits: true })
    expect(answer.body.data.etag).toBe(passwordPolicyEtag(state.passwordPolicy))
    state.failures.getPasswordPolicy = { status: 503, type: 'temporary-failure', times: 1 }
    const failed = await call('GET', '/password-policy')
    expect(failed.status).toBe(503)
    expect(failed.headers.get('retry-after')).not.toBeNull()
  })
})

describe('updateMailbox', () => {
  async function etagOf(address: string) {
    return (await call('GET', `/mailboxes/${address}`)).body.data.etag as string
  }

  it('merges nested members, replaces tags as a set and patches attributes by name', async () => {
    seed()
    const answer = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: {
        protocolAccess: { pop3: false },
        userPermissions: { syncjobs: true },
        tags: ['sales', 'Sales', 'Annapolis'],
        customAttributes: { department: 'Sales', old: null },
      },
    })
    expect(answer.status).toBe(200)
    expect(answer.body.data.protocolAccess).toMatchObject({ imap: true, pop3: false })
    expect(answer.body.data.userPermissions.syncjobs).toBe(true)
    expect(answer.body.data.tags).toEqual(['Annapolis', 'sales'])
    expect(answer.body.data.customAttributes).toEqual({ department: 'Sales' })
    expect(answer.headers.get('etag')).toBe(answer.body.data.etag)
  })

  it('refuses an outdated version with 412 (read-only members are outside MailboxPatch)', async () => {
    seed()
    const answer = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: '"old"',
      body: { displayName: 'x' },
    })
    expect(answer.status).toBe(412)
  })

  it('refuses a quota above the largest allowed one and accepts one below the usage', async () => {
    seed()
    const tooBig = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { quota: 20 * GIB },
    })
    expect(tooBig.body.errors.quota[0]).toMatchObject({
      code: 'outOfRange',
      params: { max: 10 * GIB, limit: 'largestAllowedQuota' },
    })
    const below = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { quota: 512 * MIB },
    })
    expect(below.status).toBe(200)
  })

  it('checks the password policy, stores pre-hashed values and updates passwordChangedAt', async () => {
    seed('admin', { passwordPolicy: { minLength: 10, requireDigits: true } })
    const weak = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { password: 'short' },
    })
    expect(weak.body.errors.password.map((item: { code: string }) => item.code)).toEqual([
      'tooShort',
      'missingCharacterClass',
    ])
    const hashed = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { password: '{SSHA512}abc' },
    })
    expect(hashed.status).toBe(200)
    expect(hashed.body.data.passwordChangedAt).not.toBe('2026-01-10T08:00:00.000Z')
  })

  it('refuses a password for an external source unless the request switches to mailcow', async () => {
    const state = seed()
    const refused = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: { password: 'Passw0rd-long' },
    })
    expect(refused.body.errors.password[0].code).toBe('conflictsWith')
    state.mailboxes.find((item) => item.localPart === 'carl')!.hasPassword = false
    const missing = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: { authSource: 'mailcow' },
    })
    expect(missing.body.errors.password[0].code).toBe('required')
    const switched = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: { authSource: 'mailcow', password: 'Passw0rd-long' },
    })
    expect(switched.status).toBe(200)
  })

  it('validates the recovery e-mail', async () => {
    seed()
    const invalid = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { recoveryEmail: 'nope' },
    })
    expect(invalid.body.errors.recoveryEmail[0]).toMatchObject({
      code: 'invalidFormat',
      params: { format: 'email' },
    })
    const external = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: { recoveryEmail: 'carl@b.example' },
    })
    expect(external.body.errors.recoveryEmail[0].code).toBe('conflictsWith')
  })

  it('refuses a domain administrator what the flags do not allow, but not unchanged values', async () => {
    const state = seed('reseller')
    const reseller = state.accounts.find((account) => account.username === 'reseller')!
    reseller.permissions.protocolAccess = false
    reseller.permissions.unlimitedQuota = false
    const answer = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { protocolAccess: { pop3: false, imap: true }, quota: 0 },
    })
    expect(answer.status).toBe(403)
    expect(answer.body).toMatchObject({
      attributes: ['quota', 'protocolAccess.pop3'],
      requiredFlags: { quota: 'unlimitedQuota', 'protocolAccess.pop3': 'protocolAccess' },
    })
    const unlimited = await call('PATCH', '/mailboxes/carl@a.example', {
      ifMatch: await etagOf('carl@a.example'),
      body: { quota: 0, displayName: 'Carl C' },
    })
    expect(unlimited.status).toBe(200)
  })

  it('refuses tags above the limit unless the set shrinks, and checks attribute names', async () => {
    const state = seed('admin', { mailboxCapabilities: { taggingLimit: 2 } })
    const tooMany = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { tags: ['a', 'b', 'c'] },
    })
    expect(tooMany.body.errors.tags[0]).toMatchObject({ code: 'tooMany', params: { max: 2 } })
    state.mailboxes.find((item) => item.localPart === 'anna')!.tags = ['a', 'b', 'c', 'd']
    const shrink = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { tags: ['a', 'b', 'c'] },
    })
    expect(shrink.status).toBe(200)
    const name = await call('PATCH', '/mailboxes/anna@a.example', {
      ifMatch: await etagOf('anna@a.example'),
      body: { customAttributes: { 'bad name': 'x' } },
    })
    expect(name.body.errors['customAttributes.bad name'][0].params).toEqual({
      format: 'attributeName',
    })
  })
})

describe('control changes (research R20)', () => {
  it('changes a mailbox elsewhere with a new version tag, and removes one', async () => {
    const state = seed()
    const before = (await call('GET', '/mailboxes/anna@a.example')).body.data.etag
    applyOverrides(state, { mailboxes: { set: { 'anna@a.example': { quota: 3 * GIB } } } })
    const after = (await call('GET', '/mailboxes/anna@a.example')).body.data
    expect(after.quota).toBe(3 * GIB)
    expect(after.etag).not.toBe(before)
    applyOverrides(state, { mailboxes: { remove: ['anna@a.example'] } })
    expect((await call('GET', '/mailboxes/anna@a.example')).status).toBe(404)
    expect(state.domains[0]!.usage.mailboxes).toBe(2)
  })
})
