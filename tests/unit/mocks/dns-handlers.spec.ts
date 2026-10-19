// The UI 010 mock handlers (T030, T043, T052, T064, T075, T089, T095): every response passes the
// contract validator (the setup file fails a test on any violation), and the documented behaviour
// of API 010 holds: scope, filters, sort and paging of the DKIM list, generation, import, copy,
// deletion, bulk deletion, export, publication, diagnostics with their rate limit, and MTA-STS.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'
import { DNS_PEM_FIXTURES } from '../../mocks/scenarios/dns'

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

const names = (answer: Answer) => (answer.body.data as { name: string }[]).map((item) => item.name)
const codes = (answer: Answer, path: string) =>
  (answer.body.errors[path] as { code: string }[]).map((item) => item.code)

describe('DNS capabilities', () => {
  it('answer every value to administrators and hide export and server checks from domain administrators', async () => {
    useScenario('dns-admin-fork')
    const admin = await call('GET', '/capabilities/dns')
    expect(admin.status).toBe(200)
    expect(admin.body.data).toMatchObject({
      serverHostname: 'mail.example.org',
      dkim: {
        defaultSelector: 'feldhost',
        privateKeyExportEnabled: true,
        dnsPublicationEnabled: true,
        bulkLimit: 100,
      },
      dnsDiagnostics: { serverChecks: true },
    })
    useScenario('dns-domain-admin')
    const reseller = await call('GET', '/capabilities/dns')
    expect(reseller.body.data.dkim.privateKeyExportEnabled).toBeNull()
    expect(reseller.body.data.dnsDiagnostics.serverChecks).toBe(false)
  })

  it('refuse mailbox users', async () => {
    useScenario('dns-admin', { signedInAs: 'alice@example.org' })
    expect((await call('GET', '/capabilities/dns')).status).toBe(403)
    expect((await call('GET', '/dkim-keys')).status).toBe(403)
  })
})

describe('DKIM list and entries', () => {
  it('list every entry of an administrator by name, and only the scope of a domain administrator', async () => {
    useScenario('dns-admin')
    const all = await call('GET', '/dkim-keys?limit=100')
    expect(names(all)).toEqual(
      expect.arrayContaining([
        'example.org',
        'example.net',
        'example.com',
        'missing.example',
        'old.example',
        'Legacy.Example',
      ]),
    )
    expect(all.body.meta.total).toBe(all.body.data.length)
    useScenario('dns-domain-admin')
    const scoped = await call('GET', '/dkim-keys?limit=100')
    expect(names(scoped).sort()).toEqual([
      'example.com',
      'example.net',
      'example.org',
      'missing.example',
    ])
  })

  it('filter by state, kind, selector, completeness, domain and search', async () => {
    useScenario('dns-admin')
    expect(names(await call('GET', '/dkim-keys?state=missing'))).toEqual([
      'example.net',
      'missing.example',
    ])
    expect(names(await call('GET', '/dkim-keys?state=unused&state=missing'))).toEqual([
      'example.net',
      'Legacy.Example',
      'missing.example',
      'old.example',
    ])
    expect(names(await call('GET', '/dkim-keys?kind=aliasDomain'))).toEqual([
      'example.com',
      'missing.example',
    ])
    expect(names(await call('GET', '/dkim-keys?selector=shop'))).toEqual(['shop.example'])
    expect(names(await call('GET', '/dkim-keys?complete=false'))).toEqual(['incomplete.example'])
    expect(names(await call('GET', '/dkim-keys?domain=example.org'))).toEqual([
      'example.com',
      'example.org',
    ])
    expect(names(await call('GET', '/dkim-keys?q=b%C3%BCcher'))).toEqual(['xn--bcher-kva.example'])
  })

  it('sort entries without a key last by selector and key length, and page', async () => {
    useScenario('dns-admin')
    const bySelector = names(await call('GET', '/dkim-keys?sort=selector&limit=100'))
    expect(bySelector.slice(-2)).toEqual(['example.net', 'missing.example'])
    const byLength = names(
      await call('GET', '/dkim-keys?sort=keyLength&order=desc&complete=true&limit=3'),
    )
    expect(byLength[0]).toMatch(/^a{63}\./)
    const descending = names(await call('GET', '/dkim-keys?sort=keyLength&order=desc&limit=100'))
    expect(descending.slice(0, 3).sort()).toEqual([
      'example.net',
      'incomplete.example',
      'missing.example',
    ])
    const second = await call('GET', '/dkim-keys?limit=2&offset=2')
    expect(second.body.meta).toMatchObject({ limit: 2, offset: 2 })
    expect(second.body.data).toHaveLength(2)
  })

  it('read an entry by its stored or normalised name, with its version tag', async () => {
    useScenario('dns-admin')
    const entry = await call('GET', '/dkim-keys/EXAMPLE.org')
    expect(entry.status).toBe(200)
    expect(entry.body.data.name).toBe('example.org')
    expect(entry.headers.get('etag')).toBe(entry.body.data.etag)
    expect(entry.body.data.key.record.name).toBe('dkim._domainkey.example.org')
    expect((await call('GET', '/dkim-keys/Legacy.Example')).body.data.state).toBe('unused')
    const missing = await call('GET', '/dkim-keys/example.net')
    expect(missing.body.data).toMatchObject({ state: 'missing', key: null, etag: null })
    useScenario('dns-domain-admin')
    expect((await call('GET', '/dkim-keys/shop.example')).status).toBe(404)
  })
})

describe('DKIM generation', () => {
  it('creates a key with the default selector and reports the publication outcome', async () => {
    useScenario('dns-admin')
    const created = await call('POST', '/dkim-keys', { body: { name: 'example.net' } })
    expect(created.status).toBe(201)
    expect(created.headers.get('location')).toBe('/api/v2/dkim-keys/example.net')
    expect(created.body.data).toMatchObject({
      state: 'valid',
      key: { selector: 'dkim', keyLength: 2048, complete: true },
      dnsPublication: { status: 'notConfigured', recordName: null, reason: null },
    })
    const again = await call('POST', '/dkim-keys', { body: { name: 'example.net' } })
    expect(again.status).toBe(409)
    expect(again.body.type).toBe('/api/v2/problems/dkim-key-exists')
  })

  it('refuses a key size outside the allowed sizes and names outside the scope', async () => {
    const state = useScenario('dns-admin')
    state.dns.capabilities.dkim.allowedKeySizes = [2048, 4096]
    const size = await call('POST', '/dkim-keys', { body: { name: 'example.net', keySize: 1024 } })
    expect(size.status).toBe(422)
    expect(size.body.errors.keySize[0]).toMatchObject({
      code: 'notInList',
      params: { allowed: [2048, 4096] },
    })
    expect((await call('POST', '/dkim-keys', { body: { name: 'old.example' } })).status).toBe(404)
  })

  it('replaces a key for administrators with If-Match, and refuses overwrite to domain administrators', async () => {
    useScenario('dns-admin-fork')
    const before = await call('GET', '/dkim-keys/example.org')
    const stale = await call('POST', '/dkim-keys', {
      body: { name: 'example.org', overwrite: true, selector: 'mx2026' },
      ifMatch: '"stale"',
    })
    expect(stale.status).toBe(412)
    const replaced = await call('POST', '/dkim-keys', {
      body: { name: 'example.org', overwrite: true, selector: 'mx2026' },
      ifMatch: before.body.data.etag,
    })
    expect(replaced.status).toBe(200)
    expect(replaced.body.data.key.selector).toBe('mx2026')
    expect(replaced.body.data.etag).not.toBe(before.body.data.etag)
    expect(replaced.body.data.dnsPublication).toMatchObject({
      status: 'published',
      recordName: 'mx2026._domainkey',
    })
    useScenario('dns-domain-admin')
    const refused = await call('POST', '/dkim-keys', {
      body: { name: 'example.org', overwrite: true },
    })
    expect(refused.status).toBe(403)
  })

  it('answers an injected publication outcome', async () => {
    const state = useScenario('dns-admin-fork')
    state.dns.publication.generateDkimKey = {
      status: 'failed',
      recordName: 'dkim._domainkey',
      reason: { code: 'timeout', detail: null },
    }
    const created = await call('POST', '/dkim-keys', { body: { name: 'example.net' } })
    expect(created.body.data.dnsPublication.reason.code).toBe('timeout')
  })
})

describe('DKIM import', () => {
  it('imports a PKCS #1 key with CRLF for a new name as unused, never echoing the key', async () => {
    useScenario('dns-admin')
    const imported = await call('POST', '/dkim-keys/import.example/import', {
      body: { privateKey: DNS_PEM_FIXTURES.pkcs1Crlf, selector: 'mx2024' },
    })
    expect(imported.status).toBe(201)
    expect(imported.body.data).toMatchObject({
      state: 'unused',
      kind: 'none',
      key: { selector: 'mx2024', keyLength: 2048 },
    })
    expect(JSON.stringify(imported.body)).not.toContain('PRIVATE KEY')
  })

  it('refuses keys by rule code', async () => {
    useScenario('dns-admin')
    const rule = async (privateKey: string) =>
      codes(
        await call('POST', '/dkim-keys/example.net/import', { body: { privateKey } }),
        'privateKey',
      )
    expect(await rule('not a key')).toEqual(['invalidPrivateKey'])
    expect(await rule(DNS_PEM_FIXTURES.encrypted)).toEqual(['encryptedPrivateKey'])
    expect(await rule(DNS_PEM_FIXTURES.ec)).toEqual(['unsupportedKeyType'])
    expect(await rule(DNS_PEM_FIXTURES.rsa512)).toEqual(['keyLengthOutOfRange'])
    const bytes = await call('POST', '/dkim-keys/example.net/import', {
      body: { privateKey: 'é'.repeat(9000) },
    })
    expect(bytes.body.errors.privateKey[0]).toMatchObject({
      code: 'tooLong',
      params: { max: 16384, unit: 'bytes' },
    })
  })

  it('refuses a name with a key without overwrite, and checks If-Match when overwriting', async () => {
    useScenario('dns-admin')
    const exists = await call('POST', '/dkim-keys/example.org/import', {
      body: { privateKey: DNS_PEM_FIXTURES.pkcs8 },
    })
    expect(exists.status).toBe(409)
    const stale = await call('POST', '/dkim-keys/example.org/import', {
      body: { privateKey: DNS_PEM_FIXTURES.pkcs8, overwrite: true },
      ifMatch: '"stale"',
    })
    expect(stale.status).toBe(412)
    const etag = (await call('GET', '/dkim-keys/example.org')).body.data.etag
    const replaced = await call('POST', '/dkim-keys/example.org/import', {
      body: { privateKey: DNS_PEM_FIXTURES.pkcs8, overwrite: true },
      ifMatch: etag,
    })
    expect(replaced.status).toBe(200)
    useScenario('dns-domain-admin')
    expect(
      (
        await call('POST', '/dkim-keys/example.net/import', {
          body: { privateKey: DNS_PEM_FIXTURES.pkcs8 },
        })
      ).status,
    ).toBe(403)
  })
})

describe('DKIM copy, deletion and bulk deletion', () => {
  it('copies a key to a target, refusing an incomplete source, the source itself and unknown targets', async () => {
    useScenario('dns-admin')
    const copied = await call('POST', '/dkim-keys/example.org/copy', {
      body: { target: 'example.net' },
    })
    expect(copied.status).toBe(201)
    expect(copied.body.data).toMatchObject({ name: 'example.net', key: { selector: 'dkim' } })
    expect(
      (await call('POST', '/dkim-keys/example.org/copy', { body: { target: 'example.net' } }))
        .status,
    ).toBe(409)
    expect(
      (
        await call('POST', '/dkim-keys/incomplete.example/copy', {
          body: { target: 'missing.example' },
        })
      ).status,
    ).toBe(409)
    expect(
      codes(
        await call('POST', '/dkim-keys/example.org/copy', { body: { target: 'example.org' } }),
        'target',
      ),
    ).toEqual(['sameAsSource'])
    expect(
      codes(
        await call('POST', '/dkim-keys/example.org/copy', { body: { target: 'nowhere.example' } }),
        'target',
      ),
    ).toEqual(['notFound'])
    expect(
      (await call('POST', '/dkim-keys/example.net/copy', { body: { target: 'missing.example' } }))
        .status,
    ).toBe(201)
    useScenario('dns-admin')
    expect(
      (await call('POST', '/dkim-keys/missing.example/copy', { body: { target: 'example.com' } }))
        .status,
    ).toBe(404)
  })

  it('deletes with If-Match, and removes an unused entry', async () => {
    useScenario('dns-admin')
    expect((await call('DELETE', '/dkim-keys/example.org', { ifMatch: '"stale"' })).status).toBe(
      412,
    )
    expect((await call('DELETE', '/dkim-keys/example.org')).status).toBe(204)
    expect((await call('GET', '/dkim-keys/example.org')).body.data.state).toBe('missing')
    expect((await call('DELETE', '/dkim-keys/old.example')).status).toBe(204)
    expect((await call('GET', '/dkim-keys/old.example')).status).toBe(404)
    expect((await call('DELETE', '/dkim-keys/example.net')).status).toBe(404)
  })

  it('deletes in bulk with per-target outcomes and the removal outcomes while publication is on', async () => {
    const state = useScenario('dns-admin-fork', { dns: { failingBulkTargets: ['shop.example'] } })
    const etag = (await call('GET', '/dkim-keys/example.org')).body.data.etag
    const result = await call('POST', '/dkim-keys/bulk-actions', {
      body: {
        action: 'delete',
        targets: [
          { id: 'example.org', version: etag },
          { id: 'example.org', version: etag },
          { id: 'example.com', version: '"stale"' },
          { id: 'example.net' },
          { id: 'shop.example' },
        ],
      },
    })
    expect(result.status).toBe(200)
    expect(result.body.data.results.map((item: { outcome: string }) => item.outcome)).toEqual([
      'done',
      'outdated',
      'notFound',
      'failed',
    ])
    expect(result.body.meta.dnsPublication['example.org'].status).toBe('removed')
    expect(state.dns.keys['example.org']).toBeUndefined()
    state.dns.capabilities.dkim.dnsPublicationEnabled = false
    const quiet = await call('POST', '/dkim-keys/bulk-actions', {
      body: { action: 'delete', targets: [{ id: 'old.example' }] },
    })
    expect(quiet.body.meta).toBeUndefined()
  })
})

describe('DKIM export and publication', () => {
  it('exports only while enabled, with no-store', async () => {
    useScenario('dns-admin')
    const off = await call('GET', '/dkim-keys/example.org/private-key')
    expect(off.status).toBe(403)
    expect(off.body.type).toBe('/api/v2/problems/dkim-private-key-export-disabled')
    useScenario('dns-admin-fork')
    const on = await call('GET', '/dkim-keys/example.org/private-key')
    expect(on.status).toBe(200)
    expect(on.headers.get('cache-control')).toBe('no-store')
    expect(on.body.data.privateKey).toContain('PRIVATE KEY')
    expect((await call('GET', '/dkim-keys/example.net/private-key')).status).toBe(404)
    useScenario('dns-domain-admin')
    expect((await call('GET', '/dkim-keys/example.org/private-key')).body.type).toBe(
      '/api/v2/problems/forbidden',
    )
  })

  it('publishes again only while enabled, with If-Match', async () => {
    useScenario('dns-admin')
    const off = await call('POST', '/dkim-keys/example.org/dns-publication')
    expect(off.body.type).toBe('/api/v2/problems/dkim-dns-publication-disabled')
    const state = useScenario('dns-admin-fork')
    state.dns.publication.publishDkimDnsRecord = {
      status: 'noZone',
      recordName: 'dkim._domainkey',
      reason: null,
    }
    expect(
      (await call('POST', '/dkim-keys/example.org/dns-publication', { ifMatch: '"stale"' })).status,
    ).toBe(412)
    const published = await call('POST', '/dkim-keys/example.org/dns-publication')
    expect(published.status).toBe(200)
    expect(published.body.data.dnsPublication.status).toBe('noZone')
    expect((await call('POST', '/dkim-keys/example.net/dns-publication')).status).toBe(404)
  })
})

describe('DNS diagnostics', () => {
  it('runs with server checks for administrators and rate-limit headers', async () => {
    useScenario('dns-admin')
    const run = await call('GET', '/dns-diagnostics/example.org')
    expect(run.status).toBe(200)
    expect(run.headers.get('ratelimit-limit')).toBe('10')
    expect(run.headers.get('ratelimit-remaining')).toBe('9')
    expect(run.headers.get('cache-control')).toBe('no-store')
    expect(run.body.data.serverChecksIncluded).toBe(true)
    expect((await call('GET', '/dns-diagnostics/nowhere.example')).status).toBe(404)
    useScenario('dns-domain-admin')
    const scoped = await call('GET', '/dns-diagnostics/example.com')
    expect(scoped.body.data).toMatchObject({
      serverChecksIncluded: false,
      aliasDomain: true,
      targetDomain: 'example.org',
    })
    expect(scoped.body.data.notes.map((note: { code: string }) => note.code)).toContain(
      'serverChecksOmitted',
    )
  })

  it('refuses the eleventh run in a minute with 429 and the headers', async () => {
    useScenario('dns-diagnostics-rate-limited')
    for (let run = 0; run < 3; run += 1) {
      expect((await call('GET', '/dns-diagnostics/example.org')).status).toBe(200)
    }
    const refused = await call('GET', '/dns-diagnostics/example.org')
    expect(refused.status).toBe(429)
    expect(refused.body.retryAfter).toBeGreaterThan(0)
    expect(refused.headers.get('retry-after')).toBe(String(refused.body.retryAfter))
    expect(refused.headers.get('ratelimit-remaining')).toBe('0')
  })
})

describe('MTA-STS policies', () => {
  it('list, read and create policies with their rules', async () => {
    useScenario('dns-mta-sts')
    const list = await call('GET', '/mta-sts-policies')
    expect(list.body.data.map((item: { domain: string }) => item.domain)).toEqual(['example.org'])
    expect((await call('GET', '/mta-sts-policies/example.net')).status).toBe(404)
    const invalid = await call('POST', '/mta-sts-policies', {
      body: {
        domain: 'example.net',
        mode: 'strict',
        maxAge: 0,
        mxHosts: ['mail..example', 'ok.example'],
      },
    })
    expect(invalid.status).toBe(422)
    expect(codes(invalid, 'mode')).toEqual(['notInList'])
    expect(codes(invalid, 'maxAge')).toEqual(['outOfRange'])
    expect(codes(invalid, 'mxHosts.0')).toEqual(['invalidFormat'])
    const long = await call('POST', '/mta-sts-policies', {
      body: {
        domain: 'example.net',
        mode: 'testing',
        maxAge: 86400,
        mxHosts: Array.from({ length: 6 }, (_, i) => `${'m'.repeat(40)}${i}.example`),
      },
    })
    expect(codes(long, 'mxHosts')).toEqual(['tooLong'])
    const created = await call('POST', '/mta-sts-policies', {
      body: {
        domain: 'example.net',
        mode: 'Testing',
        maxAge: 86400,
        mxHosts: ['Mail.Example.org.', 'mail.example.org', '*.example.net'],
      },
    })
    expect(created.status).toBe(201)
    expect(created.headers.get('location')).toBe('/api/v2/mta-sts-policies/example.net')
    expect(created.body.data).toMatchObject({
      mode: 'testing',
      active: false,
      mxHosts: ['mail.example.org', '*.example.net'],
    })
    expect(
      (
        await call('POST', '/mta-sts-policies', {
          body: { domain: 'example.net', mode: 'none', maxAge: 1, mxHosts: ['a.example'] },
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await call('POST', '/mta-sts-policies', {
          body: { domain: 'example.com', mode: 'none', maxAge: 1, mxHosts: ['a.example'] },
        })
      ).status,
    ).toBe(404)
  })

  it('change the identifier for mode, MX and max age changes, but not for the active state', async () => {
    useScenario('dns-mta-sts')
    const read = await call('GET', '/mta-sts-policies/example.org')
    const { policyId, etag } = read.body.data
    expect(
      (
        await call('PATCH', '/mta-sts-policies/example.org', {
          body: { active: false },
          ifMatch: '"stale"',
        })
      ).status,
    ).toBe(412)
    const inactive = await call('PATCH', '/mta-sts-policies/example.org', {
      body: { active: false },
      ifMatch: etag,
    })
    expect(inactive.status).toBe(200)
    expect(inactive.body.data.policyId).toBe(policyId)
    expect(inactive.body.data.etag).not.toBe(etag)
    const noop = await call('PATCH', '/mta-sts-policies/example.org', {
      body: { mode: 'enforce' },
      ifMatch: inactive.body.data.etag,
    })
    expect(noop.body.data.policyId).toBe(policyId)
    expect(noop.body.data.etag).toBe(inactive.body.data.etag)
    const testing = await call('PATCH', '/mta-sts-policies/example.org', {
      body: { mode: 'testing' },
      ifMatch: noop.body.data.etag,
    })
    expect(testing.body.data.policyId > policyId).toBe(true)
    expect(testing.body.data.dnsRecords[0].value).toBe(`v=STSv1;id=${testing.body.data.policyId};`)
  })
})
